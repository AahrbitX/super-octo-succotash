import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { sendCashCode } from "@/lib/whatsapp";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const resendCodeSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Payments"],
    operationId: "resendDriverCode",
    description: "Re-send the per-ride cash code to the driver via WhatsApp (stubbed as console.log)",
  },
};

export const resendCode = async ({
  user,
  params,
  set,
}: {
  user: any;
  params: { id: string };
  set: any;
}) => {
  const { id } = params;

  logger.info({ module: "payments", action: "resend-code", paymentId: id, userId: user.id }, "Resending driver code");

  const [payment] = await db
    .select({
      id:            paymentsTable.id,
      status:        paymentsTable.status,
      cashCode:      paymentsTable.cashCode,
      bookingRef:    bookingsTable.bookingRef,
      customerPhone: bookingsTable.customerPhone,
      amount:        paymentsTable.amount,
      userId:        bookingsTable.userId,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(eq(paymentsTable.id, id))
    .limit(1);

  if (!payment) {
    set.status = 404;
    return { success: false, message: "Payment not found" };
  }

  if (payment.userId !== user.id && user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  if (payment.status !== "cash_pending") {
    set.status = 400;
    return { success: false, message: "Payment is not in cash_pending state" };
  }

  if (!payment.cashCode) {
    set.status = 400;
    return { success: false, message: "No OTP generated yet. Please tap 'Pay to Driver' first." };
  }

  await sendCashCode({
    to:   payment.customerPhone,
    code: payment.cashCode,
  }).catch((err: unknown) =>
    logger.warn({ module: "whatsapp", action: "resendPaymentOtp", paymentId: id, err }, "WhatsApp send failed")
  );

  logger.info({ module: "payments", action: "resend-code", paymentId: id }, "Driver code resent");

  set.status = 200;
  return { success: true };
};
