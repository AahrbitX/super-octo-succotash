// src/routes/bookings/booking.send-payment-link.ts
import { t } from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { logger } from "@/lib/logging";
import { requireAdmin } from "@/lib/guards";
import { sendPaymentLink } from "@/lib/whatsapp";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const sendPaymentLinkSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Bookings"],
    description: "Admin: send a pending payment link to the customer via WhatsApp",
  },
};

export const sendPaymentLinkHandler = async ({
  params,
  user,
  set,
}: {
  params: { id: string };
  user: any;
  set: any;
}) => {
  requireAdmin({ user, set } as any);

  const [booking] = await db
    .select({
      id:            bookingsTable.id,
      bookingRef:    bookingsTable.bookingRef,
      status:        bookingsTable.status,
      customerName:  bookingsTable.customerName,
      customerPhone: bookingsTable.customerPhone,
      qrToken:       bookingsTable.qrToken,
      totalFare:     bookingsTable.totalFare,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.id))
    .limit(1);

  if (!booking) {
    set.status = 404;
    return { success: false, message: "Booking not found" };
  }

  if (!["pending", "confirmed", "ongoing"].includes(booking.status)) {
    set.status = 400;
    return { success: false, message: `Cannot send payment link — booking status is "${booking.status}"` };
  }

  // Calculate amount due (totalFare minus any paid amounts)
  const [sumRow] = await db
    .select({ paid: sql<string>`COALESCE(SUM(${paymentsTable.amount}::numeric), 0)::text` })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.bookingId, params.id),
        inArray(paymentsTable.status, ["paid", "cash_collected"]),
      ),
    );

  const totalFare  = parseFloat(booking.totalFare ?? "0");
  const totalPaid  = parseFloat(sumRow?.paid ?? "0");
  const amountDue  = Math.max(0, totalFare - totalPaid);

  if (amountDue <= 0) {
    set.status = 400;
    return { success: false, message: "No outstanding payment for this booking" };
  }

  await sendPaymentLink({
    phone:        booking.customerPhone,
    customerName: booking.customerName,
    bookingRef:   booking.bookingRef,
    amount:       amountDue.toFixed(2),
    qrToken:      booking.qrToken,
  });

  logger.info(
    { module: "bookings", action: "send_payment_link", bookingId: params.id, amountDue, sentBy: user.id },
    "Payment link sent",
  );

  set.status = 200;
  return { success: true, message: "Payment link sent via WhatsApp" };
};
