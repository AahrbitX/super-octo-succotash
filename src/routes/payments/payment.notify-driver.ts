import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const notifyDriverSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Payments"],
    operationId: "notifyDriver",
    description: "Generate a fresh cash OTP for the payment and return it to the customer in-app.",
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
    { module: "payments", action: "generate-cash-code", paymentId: id, userId: user.id },
    "Generating cash payment code",
  );

  const [row] = await db
    .select({
      paymentUserId: bookingsTable.userId,
      bookingRef:    bookingsTable.bookingRef,
      amount:        paymentsTable.amount,
      driverId:      bookingsTable.driverId,
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

  // Generate a fresh 6-digit numeric OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await db
    .update(paymentsTable)
    .set({ cashCode: otp })
    .where(eq(paymentsTable.id, id));

  logger.info(
    { module: "payments", action: "generate-cash-code", paymentId: id, bookingRef: row.bookingRef },
    "Cash code generated — shown to customer in-app",
  );

  set.status = 200;
  return { success: true, driverAssigned: true, cashCode: otp };
};
