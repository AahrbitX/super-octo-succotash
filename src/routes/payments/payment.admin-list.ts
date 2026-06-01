import { eq, desc, sum, count, and } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import {
  bookings as bookingsTable,
  payments as paymentsTable,
} from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";

export const adminListPaymentsSchema = {
  detail: {
    tags: ["Payments"],
    operationId: "adminListPayments",
    description: "Admin: list all payments with user and booking details",
  },
};

export const adminListPayments = async ({
  user,
  set,
}: {
  user: any;
  set: any;
}) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Admin access required", data: null };
  }

  logger.info({ module: "payments", action: "admin-list", adminId: user.id }, "Admin fetching all payments");

  const rows = await db
    .select({
      id: paymentsTable.id,
      bookingId: paymentsTable.bookingId,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      mode: paymentsTable.mode,
      paymentMethod: paymentsTable.paymentMethod,
      paidAt: paymentsTable.paidAt,
      cashVerifiedAt: paymentsTable.cashVerifiedAt,
      adminVerifiedAt: paymentsTable.adminVerifiedAt,
      createdAt: paymentsTable.createdAt,
      bookingRef: bookingsTable.bookingRef,
      journeyDate: bookingsTable.journeyDate,
      totalFare: bookingsTable.totalFare,
      bookingStatus: bookingsTable.status,
      userName: userTable.name,
      userPhone: userTable.phoneNumber,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .innerJoin(userTable, eq(bookingsTable.userId, userTable.id))
    .orderBy(desc(paymentsTable.createdAt));

  // Summary stats
  const [stats] = await db
    .select({
      totalRevenue: sum(paymentsTable.amount),
      totalCount: count(paymentsTable.id),
    })
    .from(paymentsTable)
    .where(eq(paymentsTable.status, "paid"));

  const [cashStats] = await db
    .select({ cashCount: count(paymentsTable.id) })
    .from(paymentsTable)
    .where(eq(paymentsTable.paymentMethod, "cash"));

  const [pendingStats] = await db
    .select({ pendingCount: count(paymentsTable.id) })
    .from(paymentsTable)
    .where(eq(paymentsTable.status, "created"));

  set.status = 200;
  return {
    success: true,
    summary: {
      totalRevenue: stats?.totalRevenue ?? "0",
      totalTransactions: stats?.totalCount ?? 0,
      cashPayments: cashStats?.cashCount ?? 0,
      pendingPayments: pendingStats?.pendingCount ?? 0,
    },
    data: rows,
  };
};
