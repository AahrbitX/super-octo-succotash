import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const verifyCodeSchema = {
  params: t.Object({ id: t.String() }),
  body: t.Object({ code: t.String({ minLength: 1 }) }),
  detail: {
    tags: ["Payments"],
    operationId: "verifyCashCode",
    description: "Verify the per-ride cash code to confirm the driver collected the payment",
  },
};

export const verifyCode = async ({
  user,
  params,
  body,
  set,
}: {
  user: any;
  params: { id: string };
  body: { code: string };
  set: any;
}) => {
  const { id } = params;
  const { code } = body;

  logger.info(
    { module: "payments", action: "verify-code", paymentId: id, userId: user.id },
    "Verifying cash code",
  );

  const [payment] = await db
    .select({
      id: paymentsTable.id,
      status: paymentsTable.status,
      cashCode: paymentsTable.cashCode,
      bookingUserId: bookingsTable.userId,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(eq(paymentsTable.id, id))
    .limit(1);

  if (!payment) {
    set.status = 404;
    return { success: false, message: "Payment not found" };
  }

  if (payment.bookingUserId !== user.id && user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  if (payment.status !== "cash_pending") {
    set.status = 400;
    return { success: false, message: "Payment is not awaiting cash verification" };
  }

  if (!payment.cashCode) {
    set.status = 400;
    return { success: false, message: "No code generated yet. Please tap 'Pay to Driver' first." };
  }

  if (code.trim().toUpperCase() !== payment.cashCode.toUpperCase()) {
    logger.warn(
      { module: "payments", action: "verify-code", paymentId: id },
      "Invalid cash code entered",
    );
    set.status = 400;
    return { success: false, message: "Invalid code. Please ask your driver for the correct code." };
  }

  await db
    .update(paymentsTable)
    .set({ status: "cash_collected", cashVerifiedAt: new Date() })
    .where(eq(paymentsTable.id, id));

  logger.info(
    { module: "payments", action: "verify-code", paymentId: id },
    "Cash payment confirmed by per-ride code",
  );

  set.status = 200;
  return { success: true };
};
