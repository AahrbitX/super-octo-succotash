// src/routes/dispatchers/dispatchers.resend-link.ts
import { t } from "elysia";
import { eq } from "drizzle-orm";
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

export const dispatcherResendLinkSchema = {
  params: t.Object({
    bookingId: t.String(),
  }),
  detail: {
    tags: ["Dispatchers"],
    description: "Resend the driver tracking link via WhatsApp",
  },
};

export const dispatcherResendLink = async ({
  params,
  user,
  set,
}: {
  params: { bookingId: string };
  user: any;
  set: any;
}) => {
  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace   = alias(placesTable, "drop_place");

  const [booking] = await db
    .select({
      id:           bookingsTable.id,
      bookingRef:   bookingsTable.bookingRef,
      status:       bookingsTable.status,
      driverId:     bookingsTable.driverId,
      journeyDate:  bookingsTable.journeyDate,
      journeyTime:  bookingsTable.journeyTime,
      totalFare:    bookingsTable.totalFare,
      qrToken:      bookingsTable.qrToken,
      pickupName:   pickupPlace.name,
      dropName:     dropPlace.name,
    })
    .from(bookingsTable)
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace,   eq(bookingsTable.dropId,   dropPlace.id))
    .where(eq(bookingsTable.id, params.bookingId))
    .limit(1);

  if (!booking) {
    set.status = 404;
    return { success: false, message: "Booking not found" };
  }

  if (!booking.driverId) {
    set.status = 400;
    return { success: false, message: "No driver assigned to this booking" };
  }

  if (!["confirmed", "ongoing"].includes(booking.status)) {
    set.status = 400;
    return { success: false, message: `Cannot resend link — booking status is "${booking.status}"` };
  }

  const [driverDetail] = await db
    .select({ name: usersTable.name, phone: usersTable.phoneNumber })
    .from(driversTable)
    .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
    .where(eq(driversTable.id, booking.driverId))
    .limit(1);

  if (!driverDetail?.phone) {
    set.status = 400;
    return { success: false, message: "Driver phone number not found" };
  }

  await sendBookingAssigned({
    driverPhone:     driverDetail.phone,
    driverName:      driverDetail.name ?? "Driver",
    bookingRef:      booking.bookingRef,
    journeyDateTime: `${booking.journeyDate} ${booking.journeyTime}`,
    pickupName:      booking.pickupName ?? "",
    dropName:        booking.dropName   ?? "",
    totalFare:       String(booking.totalFare),
    qrToken:         booking.qrToken,
  });

  logger.info(
    { module: "dispatchers", action: "resend_link", bookingId: params.bookingId, sentBy: user.id },
    "Driver tracking link resent",
  );

  set.status = 200;
  return { success: true, message: "Tracking link resent to driver" };
};
