import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import {
  bookings as bookingsTable,
  payments as paymentsTable,
  drivers as driversTable,
} from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";
import { alias } from "drizzle-orm/pg-core";

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

  const driverUserTable = alias(usersTable, "driver_user");

  const [payment] = await db
    .select({
      id: paymentsTable.id,
      status: paymentsTable.status,
      cashCode: paymentsTable.cashCode,
      bookingRef: bookingsTable.bookingRef,
      amount: paymentsTable.amount,
      userId: bookingsTable.userId,
      driverName: driverUserTable.name,
      driverPhone: driverUserTable.phoneNumber,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
    .leftJoin(driverUserTable, eq(driversTable.userId, driverUserTable.id))
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
    return { success: false, message: "No code generated yet. Please tap 'Pay to Driver' first." };
  }

  const msg =
    `A passenger wants to pay ₹${payment.amount} in cash for booking ${payment.bookingRef}. ` +
    `Their one-time payment code is *${payment.cashCode}*. ` +
    `Tell this code to the passenger to confirm the payment.`;

  console.log("\n📱 [WHATSAPP STUB] Cash Payment Code — Resending existing code for this ride");
  console.log("  → Driver :", payment.driverName ?? "Unknown");
  console.log("  → Phone  :", payment.driverPhone ?? "N/A");
  console.log("  → Code   :", payment.cashCode);
  console.log("  → Booking:", payment.bookingRef);
  console.log("  → Message:", msg);
  console.log("");

  logger.info({ module: "payments", action: "resend-code", paymentId: id }, "Driver code resent");

  set.status = 200;
  return { success: true };
};
