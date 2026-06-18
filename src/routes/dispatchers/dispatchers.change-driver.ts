// src/routes/dispatchers/dispatchers.change-driver.ts
import { t } from "elysia";
import { and, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as usersTable } from "@/db/auth-schema";
import {
  sendBookingAssigned,
  sendBookingCancelledToDriver,
} from "@/lib/whatsapp";

import {
  bookings as bookingsTable,
  drivers as driversTable,
  places as placesTable,
} from "@/db/schema";

export const dispatcherChangeDriverSchema = {
  params: t.Object({
    bookingId: t.String(),
  }),
  body: t.Object({
    driverId: t.String(),
  }),
  detail: {
    tags: ["Dispatchers"],
    description: "Change the assigned driver on a confirmed or ongoing booking",
  },
};

export const dispatcherChangeDriver = async ({
  params,
  body,
  user,
  set,
}: {
  params: { bookingId: string };
  body: { driverId: string };
  user: any;
  set: any;
}) => {
  // Generate a fresh ride-start OTP
  const rideStartOtp = String(Math.floor(1000 + Math.random() * 9000));

  const result = await db.transaction(async (tx) => {
    // Fetch the current booking
    const [booking] = await tx
      .select({
        id:            bookingsTable.id,
        bookingRef:    bookingsTable.bookingRef,
        status:        bookingsTable.status,
        driverId:      bookingsTable.driverId,
        customerName:  bookingsTable.customerName,
        customerPhone: bookingsTable.customerPhone,
        qrToken:       bookingsTable.qrToken,
        totalFare:     bookingsTable.totalFare,
        journeyDate:   bookingsTable.journeyDate,
        journeyTime:   bookingsTable.journeyTime,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, params.bookingId))
      .limit(1);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!inArray(booking.status as any, ["confirmed", "ongoing"])) {
      throw new Error(`Cannot change driver — booking status is "${booking.status}"`);
    }

    if (booking.driverId === body.driverId) {
      throw new Error("New driver is the same as the current driver");
    }

    // Verify the new driver exists
    const [newDriver] = await tx
      .select({ id: driversTable.id })
      .from(driversTable)
      .where(eq(driversTable.id, body.driverId))
      .limit(1);

    if (!newDriver) {
      throw new Error("Driver not found");
    }

    // Update booking with new driver + fresh OTP
    const [updated] = await tx
      .update(bookingsTable)
      .set({
        driverId: body.driverId,
        rideStartOtp,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, params.bookingId))
      .returning();

    return { updated, previousDriverId: booking.driverId, booking };
  });

  logger.info(
    {
      module: "dispatchers",
      action: "change_driver",
      bookingId: params.bookingId,
      previousDriverId: result.previousDriverId,
      newDriverId: body.driverId,
      changedBy: user.id,
    },
    "Driver changed successfully",
  );

  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace   = alias(placesTable, "drop_place");

  const [bookingDetail] = await db
    .select({
      pickupName: pickupPlace.name,
      dropName:   dropPlace.name,
    })
    .from(bookingsTable)
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace,   eq(bookingsTable.dropId,   dropPlace.id))
    .where(eq(bookingsTable.id, result.updated.id))
    .limit(1);

  // Notify old driver of cancellation
  if (result.previousDriverId) {
    const [oldDriverDetail] = await db
      .select({ name: usersTable.name, phone: usersTable.phoneNumber })
      .from(driversTable)
      .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(eq(driversTable.id, result.previousDriverId))
      .limit(1);

    if (oldDriverDetail?.phone) {
      await sendBookingCancelledToDriver({
        driverPhone:  oldDriverDetail.phone,
        driverName:   oldDriverDetail.name ?? "Driver",
        bookingRef:   result.updated.bookingRef,
        customerName: result.updated.customerName,
        journeyDate:  result.updated.journeyDate,
        journeyTime:  result.updated.journeyTime,
      }).catch((err) =>
        logger.warn({ module: "whatsapp", action: "sendBookingCancelledToDriver", err }, "WhatsApp send failed")
      );
    }
  }

  // Notify new driver
  const [newDriverDetail] = await db
    .select({ name: usersTable.name, phone: usersTable.phoneNumber })
    .from(driversTable)
    .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
    .where(eq(driversTable.id, body.driverId))
    .limit(1);

  if (newDriverDetail?.phone && bookingDetail) {
    await sendBookingAssigned({
      driverPhone:     newDriverDetail.phone,
      driverName:      newDriverDetail.name ?? "Driver",
      bookingRef:      result.updated.bookingRef,
      journeyDateTime: `${result.updated.journeyDate} ${result.updated.journeyTime}`,
      pickupName:      bookingDetail.pickupName ?? "",
      dropName:        bookingDetail.dropName   ?? "",
      totalFare:       String(result.updated.totalFare),
      qrToken:         result.updated.qrToken,
    }).catch((err) =>
      logger.warn({ module: "whatsapp", action: "sendBookingAssigned", err }, "WhatsApp send failed")
    );
  }

  // Ride-start OTP is stored in DB and shown to the customer in their upcoming ride card (in-app)

  set.status = 200;
  return {
    success: true,
    message: "Driver changed successfully",
    data: result.updated,
  };
};
