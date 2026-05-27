import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { bookings as bookingsTable, drivers as driversTable, payments as paymentsTable } from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";
import { logger } from "@/lib/logging";

export const cancelBooking = async ({
  user,
  params,
  set,
}: {
  user: any;
  params: { id: string };
  set: any;
}) => {
  const booking = await db
    .select({
      id: bookingsTable.id,
      userId: bookingsTable.userId,
      status: bookingsTable.status,
      bookingRef: bookingsTable.bookingRef,
      driverId: bookingsTable.driverId,
      customerName: bookingsTable.customerName,
      journeyDate: bookingsTable.journeyDate,
      journeyTime: bookingsTable.journeyTime,
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

  if (!["pending", "confirmed"].includes(booking[0].status)) {
    set.status = 400;
    return { success: false, message: "Only pending or confirmed bookings can be cancelled" };
  }

  await db
    .update(bookingsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(bookingsTable.id, params.id));

  // Void any pending (created) payment orders for this booking
  await db
    .update(paymentsTable)
    .set({ status: "failed" })
    .where(
      and(
        eq(paymentsTable.bookingId, params.id),
        eq(paymentsTable.status, "created"),
      ),
    );

  logger.info({ module: "bookings", action: "cancel", bookingId: params.id, userId: user.id }, "Booking cancelled");

  // Notify driver if one was assigned — replace console.log with WhatsApp when ready
  if (booking[0].driverId) {
    const [driverRow] = await db
      .select({ name: usersTable.name, phone: usersTable.phoneNumber })
      .from(driversTable)
      .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(eq(driversTable.id, booking[0].driverId))
      .limit(1);

    if (driverRow) {
      console.log(`[WhatsApp stub] Notify driver of cancellation.`);
      console.log(`  Driver : ${driverRow.name} (${driverRow.phone})`);
      console.log(`  Booking: ${booking[0].bookingRef}`);
      console.log(`  Rider  : ${booking[0].customerName}`);
      console.log(`  Journey: ${booking[0].journeyDate} at ${booking[0].journeyTime}`);
      console.log(`  Message: "Your ride for ${booking[0].customerName} on ${booking[0].journeyDate} at ${booking[0].journeyTime} has been cancelled."`);
    }
  }

  return { success: true, message: "Booking cancelled" };
};
