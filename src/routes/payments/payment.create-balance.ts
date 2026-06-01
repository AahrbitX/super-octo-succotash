import { t } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const createBalancePaymentSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Payments"],
    operationId: "createBalancePayment",
    description:
      "Create a cash payment record for the remaining balance on a partial booking. " +
      "The source payment must be partial+paid. Returns the new payment ID.",
  },
};

export const createBalancePayment = async ({
  user,
  params,
  set,
}: {
  user: any;
  params: { id: string };
  set: any;
}) => {
  const { id } = params;

  logger.info(
    { module: "payments", action: "create-balance", sourcePaymentId: id, userId: user.id },
    "Creating balance payment for partial booking",
  );

  // Load the source (advance) payment
  const [source] = await db
    .select({
      bookingId: paymentsTable.bookingId,
      status: paymentsTable.status,
      mode: paymentsTable.mode,
      amount: paymentsTable.amount,
      userId: bookingsTable.userId,
      totalFare: bookingsTable.totalFare,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(eq(paymentsTable.id, id))
    .limit(1);

  if (!source) {
    set.status = 404;
    return { success: false, message: "Payment not found" };
  }

  if (source.userId !== user.id && user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  if (source.status !== "paid" || source.mode !== "partial") {
    set.status = 400;
    return { success: false, message: "Source payment must be a paid partial advance" };
  }

  const remaining = parseFloat(source.totalFare) - parseFloat(source.amount);
  if (remaining <= 0.01) {
    set.status = 400;
    return { success: false, message: "No balance remaining on this booking" };
  }

  // Atomic upsert — the unique partial index on (bookingId WHERE mode='balance') means
  // concurrent duplicate requests are silently ignored rather than creating two records.
  const [inserted] = await db
    .insert(paymentsTable)
    .values({
      bookingId: source.bookingId,
      rzpOrderId: `cash_balance_${nanoid(10)}`,
      amount: String(remaining.toFixed(2)),
      currency: "INR",
      mode: "balance",
      status: "cash_pending",
      paymentMethod: "cash",
    })
    .onConflictDoNothing()
    .returning({ id: paymentsTable.id });

  // If insert was a no-op (conflict with existing balance record), fetch that record
  const paymentId: string | undefined =
    inserted?.id ??
    (await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.bookingId, source.bookingId), eq(paymentsTable.mode, "balance")))
      .limit(1)
      .then(([r]) => r?.id));

  if (!paymentId) {
    set.status = 500;
    return { success: false, message: "Failed to resolve balance payment" };
  }

  logger.info(
    { module: "payments", action: "create-balance", paymentId, amount: remaining, wasNew: !!inserted },
    inserted ? "Balance payment record created" : "Balance payment already exists — returning existing",
  );

  set.status = inserted ? 201 : 200;
  return { success: true, data: { paymentId } };
};
