import { db } from "@/db";
import { t } from "elysia";
import { eq } from "drizzle-orm";

import {
  bookings as bookingsTable,
  drivers as driversTable,
} from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

import { logger } from "@/lib/logging";
import { sendAdminAlertToAll, getAdminPhones } from "@/lib/whatsapp";

export const completeBookingSchema = {
  params: t.Object({
    id: t.String(),
  }),
  detail: {
    tags: ["Bookings"],
    description: "",
  },
};

export const completeBooking = async ({
  user,
  params,
  set,
}: {
  set: any;
  user: any;
  params: (typeof completeBookingSchema)["params"]["static"];
}) => {
  const booking = await db
    .select({
      id: bookingsTable.id,
      userId: bookingsTable.userId,
      status: bookingsTable.status,
      bookingRef: bookingsTable.bookingRef,
      customerName: bookingsTable.customerName,
      driverId: bookingsTable.driverId,
      journeyDate: bookingsTable.journeyDate,
      journeyTime: bookingsTable.journeyTime,
      totalFare: bookingsTable.totalFare,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.id))
    .limit(1);

  if (!booking[0]) {
    set.status = 404;
    return { success: false, message: "Booking not found" };
  }

  const isAdmin = user.role === "admin";
  const isOwner = booking[0].userId === user.id;

  if (!isAdmin && !isOwner) {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  if (!["ongoing", "confirmed"].includes(booking[0].status)) {
    set.status = 400;
    return {
      success: false,
      message: "Only ongoing or confirmed bookings can be completed",
    };
  }

  await db
    .update(bookingsTable)
    .set({
      status: "completed",
      rideEndedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, params.id));

  logger.info(
    {
      module: "bookings",
      action: "complete",
      bookingId: params.id,
      userId: user.id,
    },
    "Booking completed",
  );

  // Notify all admins — replace console.log with WhatsApp when ready
  const b = booking[0];

  const [driverRow] = b.driverId
    ? await db
        .select({ name: usersTable.name, phone: usersTable.phoneNumber })
        .from(driversTable)
        .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
        .where(eq(driversTable.id, b.driverId))
        .limit(1)
    : [null];

  const adminPhones = getAdminPhones();

  await sendAdminAlertToAll(adminPhones, {
    eventType: "Ride Completed",
    bookingRef: b.bookingRef,
    details: `${b.customerName} | Driver: ${driverRow?.name ?? "—"} | ₹${b.totalFare}`,
  }).catch((err) =>
    logger.warn(
      {
        module: "whatsapp",
        action: "adminAlertComplete",
        bookingId: params.id,
        err,
      },
      "WhatsApp send failed",
    ),
  );

  return { success: true, message: "Booking marked as completed" };
};
