import { eq, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import {
  bookings as bookingsTable,
  payments as paymentsTable,
  places as placesTable,
} from "@/db/schema";

export const listTransactionsSchema = {
  detail: {
    tags: ["Payments"],
    operationId: "listMyTransactions",
    description: "Get the logged-in user's payment history and pending payments",
  },
};

export const listTransactions = async ({
  user,
  set,
}: {
  user: any;
  set: any;
}) => {
  logger.info(
    { module: "payments", action: "list-transactions", userId: user.id },
    "Fetching user transactions",
  );

  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace   = alias(placesTable, "drop_place");

  const data = await db
    .select({
      id: paymentsTable.id,
      bookingId: paymentsTable.bookingId,
      rzpOrderId: paymentsTable.rzpOrderId,
      rzpPaymentId: paymentsTable.rzpPaymentId,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      mode: paymentsTable.mode,
      paymentMethod: paymentsTable.paymentMethod,
      paidAt: paymentsTable.paidAt,
      cashVerifiedAt: paymentsTable.cashVerifiedAt,
      adminVerifiedBy: paymentsTable.adminVerifiedBy,
      adminVerifiedAt: paymentsTable.adminVerifiedAt,
      createdAt: paymentsTable.createdAt,
      bookingRef: bookingsTable.bookingRef,
      journeyDate: bookingsTable.journeyDate,
      journeyTime: bookingsTable.journeyTime,
      totalFare: bookingsTable.totalFare,
      bookingStatus: bookingsTable.status,
      driverId: bookingsTable.driverId,
      pickupName: pickupPlace.name,
      dropName: dropPlace.name,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))
    .where(eq(bookingsTable.userId, user.id))
    .orderBy(desc(paymentsTable.createdAt));

  set.status = 200;
  return { success: true, data };
};
