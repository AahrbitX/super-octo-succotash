import { t } from "elysia";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const driverVerifyPaymentSchema = {
  params: t.Object({ token: t.String() }),
  body: t.Object({ code: t.String({ minLength: 1 }) }),
};

export const driverVerifyPayment = async ({
  params,
  body,
  set,
}: {
  params: { token: string };
  body: { code: string };
  set: any;
}) => {
  const { token } = params;
  const { code } = body;

  const [booking] = await db
    .select({ id: bookingsTable.id, status: bookingsTable.status })
    .from(bookingsTable)
    .where(eq(bookingsTable.qrToken, token))
    .limit(1);

  if (!booking) {
    set.status = 404;
    return { success: false, message: "Ride not found" };
  }

  const [payment] = await db
    .select({ id: paymentsTable.id, cashCode: paymentsTable.cashCode })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.bookingId, booking.id),
        eq(paymentsTable.status, "cash_pending"),
      ),
    )
    .limit(1);

  if (!payment) {
    set.status = 400;
    return { success: false, message: "No pending cash payment found for this ride" };
  }

  if (!payment.cashCode || code.trim().toUpperCase() !== payment.cashCode.toUpperCase()) {
    logger.warn({ module: "driver", action: "verify-payment", bookingId: booking.id }, "Invalid payment OTP entered by driver");
    set.status = 400;
    return { success: false, message: "Invalid OTP. Ask the customer to check their WhatsApp." };
  }

  await db
    .update(paymentsTable)
    .set({ status: "cash_collected", cashVerifiedAt: new Date() })
    .where(eq(paymentsTable.id, payment.id));

  logger.info({ module: "driver", action: "verify-payment", bookingId: booking.id }, "Cash payment confirmed by driver");

  return { success: true, message: "Cash payment confirmed" };
};
