import { t } from "elysia";
import { and, eq } from "drizzle-orm";
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

  // Guard: don't create a duplicate if one already exists for this booking+balance
  const [existing] = await db
    .select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.bookingId, source.bookingId),
        eq(paymentsTable.mode, "balance"),
      ),
    )
    .limit(1);

  if (existing) {
    // Return the existing balance payment so the UI can proceed
    logger.info(
      { module: "payments", action: "create-balance", existingId: existing.id },
      "Balance payment already exists — returning existing record",
    );
    set.status = 200;
    return { success: true, data: { paymentId: existing.id } };
  }

  // Create the cash balance payment record
  const [inserted] = await db
    .insert(paymentsTable)
    .values({
      bookingId: source.bookingId,
      rzpOrderId: `cash_balance_${nanoid(10)}`,   // placeholder — not an online payment
      amount: String(remaining.toFixed(2)),
      currency: "INR",
      mode: "balance",
      status: "cash_pending",
      paymentMethod: "cash",
    })
    .returning({ id: paymentsTable.id });

  logger.info(
    { module: "payments", action: "create-balance", newPaymentId: inserted.id, amount: remaining },
    "Balance payment record created",
  );

  set.status = 201;
  return { success: true, data: { paymentId: inserted.id } };
};
