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
import { nanoid } from "nanoid";

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

  const driverUserTable = alias(usersTable, "driver_user");

  const [row] = await db
    .select({
      paymentUserId: bookingsTable.userId,
      bookingRef: bookingsTable.bookingRef,
      amount: paymentsTable.amount,
      driverId: bookingsTable.driverId,
      driverName: driverUserTable.name,
      driverPhone: driverUserTable.phoneNumber,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
    .leftJoin(driverUserTable, eq(driversTable.userId, driverUserTable.id))
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

  // Generate a fresh 6-char code for this ride and persist it
  const code = nanoid(6).toUpperCase();
  await db
    .update(paymentsTable)
    .set({ cashCode: code })
    .where(eq(paymentsTable.id, id));

  const msg =
    `A passenger wants to pay ₹${row.amount} in cash for booking ${row.bookingRef}. ` +
    `Their one-time payment code is *${code}*. ` +
    `Tell this code to the passenger to confirm the payment.`;

  console.log("\n📱 [WHATSAPP STUB] Cash Payment Code — New code generated for this ride");
  console.log("  → Driver :", row.driverName ?? "Unknown");
  console.log("  → Phone  :", row.driverPhone ?? "N/A");
  console.log("  → Code   :", code);
  console.log("  → Booking:", row.bookingRef);
  console.log("  → Message:", msg);
  console.log("");

  set.status = 200;
  return { success: true, driverAssigned: true };
};
