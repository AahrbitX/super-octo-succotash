import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import {
  bookings as bookingsTable,
  payments as paymentsTable,
  places,
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

  const rows = await db
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
      pickupId: bookingsTable.pickupId,
      dropId: bookingsTable.dropId,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(eq(bookingsTable.userId, user.id))
    .orderBy(desc(paymentsTable.createdAt));

  if (rows.length === 0) {
    set.status = 200;
    return { success: true, data: [] };
  }

  // Fetch place names for all pickup/drop IDs in one query
  const placeIds = [...new Set(rows.flatMap((r) => [r.pickupId, r.dropId]))];
  const placeRows = await db
    .select({ id: places.id, name: places.name })
    .from(places)
    .where(inArray(places.id, placeIds));

  const placeMap = Object.fromEntries(placeRows.map((p) => [p.id, p.name]));

  const data = rows.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    rzpOrderId: r.rzpOrderId,
    rzpPaymentId: r.rzpPaymentId,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    mode: r.mode,
    paymentMethod: r.paymentMethod,
    paidAt: r.paidAt,
    cashVerifiedAt: r.cashVerifiedAt,
    adminVerifiedBy: r.adminVerifiedBy,
    adminVerifiedAt: r.adminVerifiedAt,
    createdAt: r.createdAt,
    bookingRef: r.bookingRef,
    journeyDate: r.journeyDate,
    journeyTime: r.journeyTime,
    totalFare: r.totalFare,
    bookingStatus: r.bookingStatus,
    driverId: r.driverId,
    pickupName: placeMap[r.pickupId] ?? r.pickupId,
    dropName: placeMap[r.dropId] ?? r.dropId,
  }));

  set.status = 200;
  return { success: true, data };
};
