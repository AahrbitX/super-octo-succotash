import { t } from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";
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
      "Create a cash payment record for the remaining balance on a booking. " +
      "Accepts either a payment ID or booking ID. Returns the new (or existing) balance payment ID.",
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

  // ── Resolve booking ────────────────────────────────────────────────────────
  // Accept either a payment ID or a booking ID so callers don't need to know which.

  let bookingId: string | null = null;
  let totalFare: number        = 0;
  let bookingUserId: string    = "";

  // Try as payment ID first
  const [byPayment] = await db
    .select({
      bookingId: paymentsTable.bookingId,
      totalFare: bookingsTable.totalFare,
      userId:    bookingsTable.userId,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(eq(paymentsTable.id, id))
    .limit(1);

  if (byPayment) {
    bookingId     = byPayment.bookingId;
    totalFare     = parseFloat(byPayment.totalFare ?? "0");
    bookingUserId = byPayment.userId ?? "";
  } else {
    // Try as booking ID directly
    const [byBooking] = await db
      .select({ id: bookingsTable.id, totalFare: bookingsTable.totalFare, userId: bookingsTable.userId })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .limit(1);

    if (!byBooking) {
      set.status = 404;
      return { success: false, message: "Payment or booking not found" };
    }

    bookingId     = byBooking.id;
    totalFare     = parseFloat(byBooking.totalFare ?? "0");
    bookingUserId = byBooking.userId ?? "";
  }

  if (bookingUserId !== user.id && user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  // ── Calculate total already paid ──────────────────────────────────────────
  const [sumRow] = await db
    .select({ paid: sql<string>`COALESCE(SUM(${paymentsTable.amount}::numeric), 0)::text` })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.bookingId, bookingId!),
        inArray(paymentsTable.status, ["paid", "cash_collected"]),
      ),
    );

  const totalPaid  = parseFloat(sumRow?.paid ?? "0");
  const remaining  = totalFare - totalPaid;

  if (remaining <= 0.01) {
    set.status = 400;
    return { success: false, message: "No balance remaining on this booking" };
  }

  logger.info(
    { module: "payments", action: "create-balance", bookingId, totalFare, totalPaid, remaining, userId: user.id },
    "Creating balance payment",
  );

  // ── Upsert balance payment ────────────────────────────────────────────────
  const [inserted] = await db
    .insert(paymentsTable)
    .values({
      bookingId:     bookingId!,
      rzpOrderId:    `cash_balance_${nanoid(10)}`,
      amount:        String(remaining.toFixed(2)),
      currency:      "INR",
      mode:          "balance",
      status:        "cash_pending",
      paymentMethod: "cash",
    })
    .onConflictDoNothing()
    .returning({ id: paymentsTable.id });

  const paymentId: string | undefined =
    inserted?.id ??
    (await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.bookingId, bookingId!), eq(paymentsTable.mode, "balance")))
      .limit(1)
      .then(([r]) => r?.id));

  if (!paymentId) {
    set.status = 500;
    return { success: false, message: "Failed to resolve balance payment" };
  }

  set.status = inserted ? 201 : 200;
  return { success: true, data: { paymentId } };
};
