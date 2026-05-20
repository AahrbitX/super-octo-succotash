import { createHmac } from "crypto";
import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const verifyPaymentSchema = {
  body: t.Object({
    bookingId:       t.String(),
    rzp_order_id:    t.String(),
    rzp_payment_id:  t.String(),
    rzp_signature:   t.String(),
  }),
  detail: {
    tags: ["Payments"],
    operationId: "verifyPayment",
    description: "Verify Razorpay payment signature and confirm booking",
  },
};

export const verifyPayment = async ({
  user,
  set,
  body,
}: {
  user: any;
  set: any;
  body: (typeof verifyPaymentSchema)["body"]["static"];
}) => {
  const { bookingId, rzp_order_id, rzp_payment_id, rzp_signature } = body;

  logger.info({ module: "payments", action: "verify", bookingId, rzp_order_id }, "Verifying payment signature");

  // 1. Verify HMAC-SHA256 signature
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${rzp_order_id}|${rzp_payment_id}`)
    .digest("hex");

  if (expected !== rzp_signature) {
    logger.warn({ module: "payments", action: "verify", bookingId }, "Signature mismatch");
    set.status = 400;
    return { success: false, message: "Payment verification failed" };
  }

  // 2. Update payment record
  await db
    .update(paymentsTable)
    .set({
      rzpPaymentId: rzp_payment_id,
      status:       "paid",
      paidAt:       new Date(),
    })
    .where(eq(paymentsTable.rzpOrderId, rzp_order_id));

  // 3. Confirm the booking
  await db
    .update(bookingsTable)
    .set({ status: "confirmed" })
    .where(eq(bookingsTable.id, bookingId));

  logger.info({ module: "payments", action: "verify", bookingId }, "Payment verified, booking confirmed");

  return { success: true, message: "Payment verified and booking confirmed" };
};
