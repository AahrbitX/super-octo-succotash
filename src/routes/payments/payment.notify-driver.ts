import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";
import { sendCashCode } from "@/lib/whatsapp";

export const notifyDriverSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Payments"],
    operationId: "notifyDriver",
    description:
      "Generate a fresh per-ride cash code, store it on the payment, and notify the driver (WhatsApp stub).",
  },
};

export const notifyDriver = async ({
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
    { module: "payments", action: "notify-driver", paymentId: id, userId: user.id },
    "Notifying driver of cash payment",
  );

  const [row] = await db
    .select({
      paymentUserId:  bookingsTable.userId,
      bookingRef:     bookingsTable.bookingRef,
      customerPhone:  bookingsTable.customerPhone,
      amount:         paymentsTable.amount,
      driverId:       bookingsTable.driverId,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(eq(paymentsTable.id, id))
    .limit(1);

  if (!row) {
    set.status = 404;
    return { success: false, message: "Payment not found" };
  }

  if (row.paymentUserId !== user.id && user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  if (!row.driverId) {
    set.status = 200;
    return { success: true, driverAssigned: false };
  }

  // Generate a fresh 6-digit numeric OTP (same format as login OTP)
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await db
    .update(paymentsTable)
    .set({ cashCode: otp })
    .where(eq(paymentsTable.id, id));

  await sendCashCode({
    to:         row.customerPhone,
    code:       otp,
    amount:     row.amount ?? "0",
    bookingRef: row.bookingRef,
  }).catch((err: unknown) =>
    logger.warn({ module: "whatsapp", action: "sendPaymentOtp", paymentId: id, err }, "WhatsApp send failed")
  );

  set.status = 200;
  return { success: true, driverAssigned: true };
};
