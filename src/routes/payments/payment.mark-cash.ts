import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const markCashSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Payments"],
    operationId: "markCashPending",
    description: "Mark a payment as cash_pending (user intends to pay driver in cash)",
  },
};

export const markCash = async ({
  user,
  params,
  set,
}: {
  user: any;
  params: { id: string };
  set: any;
}) => {
  const { id } = params;

  logger.info({ module: "payments", action: "mark-cash", paymentId: id, userId: user.id }, "Marking payment as cash");

  const [payment] = await db
    .select({
      id: paymentsTable.id,
      status: paymentsTable.status,
      userId: bookingsTable.userId,
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

  if (payment.status !== "created" && payment.status !== "cash_pending") {
    set.status = 400;
    return { success: false, message: "Payment is not in a pending state" };
  }

  // Idempotent: only update if not already cash_pending
  if (payment.status === "created") {
    await db
      .update(paymentsTable)
      .set({ paymentMethod: "cash", status: "cash_pending" })
      .where(eq(paymentsTable.id, id));
  }

  logger.info({ module: "payments", action: "mark-cash", paymentId: id }, "Payment marked as cash_pending");

  set.status = 200;
  return { success: true };
};
