// src/routes/webhooks/razorpay.ts
// Razorpay webhook handler — verifies signature, updates payment status
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { payments as paymentsTable } from "@/db/schema";

export const handleRazorpayWebhook = async ({
  request,
  set,
}: {
  request: Request;
  set: any;
}) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error({ module: "webhooks", action: "razorpay" }, "RAZORPAY_WEBHOOK_SECRET not configured");
    set.status = 500;
    return { success: false, message: "Webhook secret not configured" };
  }

  // Verify signature
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    set.status = 400;
    return { success: false, message: "Missing signature" };
  }

  const rawBody = await request.text();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature !== signature) {
    logger.warn({ module: "webhooks", action: "razorpay", reason: "signature_mismatch" }, "Webhook signature mismatch");
    set.status = 400;
    return { success: false, message: "Invalid signature" };
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    set.status = 400;
    return { success: false, message: "Invalid JSON body" };
  }

  const eventType: string = event.event;
  const paymentEntity = event.payload?.payment?.entity;

  logger.info({ module: "webhooks", action: "razorpay", eventType }, "Razorpay webhook received");

  switch (eventType) {
    case "payment.captured": {
      if (!paymentEntity?.order_id || !paymentEntity?.id) break;
      const [updated] = await db
        .update(paymentsTable)
        .set({
          status:       "paid",
          rzpPaymentId: paymentEntity.id,
          paidAt:       new Date(paymentEntity.created_at * 1000),
        })
        .where(eq(paymentsTable.rzpOrderId, paymentEntity.order_id))
        .returning({ id: paymentsTable.id, bookingId: paymentsTable.bookingId });

      if (updated) {
        logger.info(
          { module: "webhooks", action: "razorpay", event: eventType, paymentId: paymentEntity.id, bookingId: updated.bookingId },
          "Payment marked as paid via webhook",
        );
      } else {
        logger.warn(
          { module: "webhooks", action: "razorpay", event: eventType, orderId: paymentEntity.order_id },
          "No payment record found for webhook order",
        );
      }
      break;
    }

    case "payment.failed": {
      if (!paymentEntity?.order_id) break;
      await db
        .update(paymentsTable)
        .set({ status: "failed" })
        .where(eq(paymentsTable.rzpOrderId, paymentEntity.order_id));

      logger.info(
        { module: "webhooks", action: "razorpay", event: eventType, orderId: paymentEntity.order_id },
        "Payment marked as failed via webhook",
      );
      break;
    }

    default:
      logger.debug({ module: "webhooks", action: "razorpay", eventType }, "Unhandled webhook event");
  }

  set.status = 200;
  return { success: true };
};
