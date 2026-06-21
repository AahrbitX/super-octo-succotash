// src/routes/dispatchers/dispatchers.assign-driver.ts
import { t } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as usersTable } from "@/db/auth-schema";
import { sendBookingAssigned } from "@/lib/whatsapp";

import {
  bookings as bookingsTable,
  drivers as driversTable,
  places as placesTable,
} from "@/db/schema";

export const dispatcherAssignDriverSchema = {
  params: t.Object({
    bookingId: t.String(),
  }),
  body: t.Object({
    driverId: t.String(),
  }),
  detail: {
    tags: ["Dispatchers"],
    description: "",
  },
};

export const dispatcherAssignDriver = async ({
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
  // Generate a 4-digit ride start OTP
  const rideStartOtp = String(Math.floor(1000 + Math.random() * 9000));

  const result = await db.transaction(async (tx) => {
    const [driver] = await tx
      .select({ id: driversTable.id })
      .from(driversTable)
      .where(eq(driversTable.id, body.driverId))
      .limit(1);

    if (!driver) {
      throw new Error("Driver not found");
    }

    const [booking] = await tx
      .update(bookingsTable)
      .set({
        driverId: body.driverId,
        status: "confirmed",
        confirmedAt: new Date(),
        rideStartOtp,
        qrExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookingsTable.id, params.bookingId),
          isNull(bookingsTable.driverId),
        ),
      )
      .returning();

    if (!booking) {
      throw new Error("Booking already assigned");
    }

    return booking;
  });

  logger.info(
    {
      module: "dispatchers",
      action: "assign_driver",
      bookingId: params.bookingId,
      driverId: body.driverId,
      assignedBy: user.id,
    },
    "Driver assigned successfully",
  );

  // WhatsApp stub — replace with real messaging when ready
  const driverUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/driver/${result.qrToken}`;

  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace   = alias(placesTable, "drop_place");

  const [bookingDetail] = await db
    .select({
      customerName:  bookingsTable.customerName,
      customerPhone: bookingsTable.customerPhone,
      journeyDate:   bookingsTable.journeyDate,
      journeyTime:   bookingsTable.journeyTime,
      totalFare:     bookingsTable.totalFare,
      vehicleType:   bookingsTable.vehicleType,
      ac:            bookingsTable.ac,
      members:       bookingsTable.members,
      pickupName:    pickupPlace.name,
      dropName:      dropPlace.name,
    })
    .from(bookingsTable)
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace,   eq(bookingsTable.dropId,   dropPlace.id))
    .where(eq(bookingsTable.id, result.id))
    .limit(1);

  const [driverDetail] = await db
    .select({ name: usersTable.name, phone: usersTable.phoneNumber })
    .from(driversTable)
    .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
    .where(eq(driversTable.id, body.driverId))
    .limit(1);

  if (bookingDetail && driverDetail?.phone) {
    await sendBookingAssigned({
      driverPhone:     driverDetail.phone,
      driverName:      driverDetail.name ?? "Driver",
      bookingRef:      result.bookingRef,
      journeyDateTime: `${bookingDetail.journeyDate} ${bookingDetail.journeyTime}`,
      pickupName:      bookingDetail.pickupName ?? "",
      dropName:        bookingDetail.dropName   ?? "",
      totalFare:       String(bookingDetail.totalFare),
      qrToken:         result.qrToken,
    }).catch((err) =>
      logger.warn({ module: "whatsapp", action: "sendBookingAssigned", bookingId: params.bookingId, err }, "WhatsApp send failed")
    );
  }

  // Ride-start OTP is stored in DB and shown to the customer in their upcoming ride card (in-app)

  set.status = 200;

  return {
    success: true,
    message: "Driver assigned successfully",
    data: result,
  };
};
