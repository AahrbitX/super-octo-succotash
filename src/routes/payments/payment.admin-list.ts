import { and, count, desc, eq, ilike, or, sum } from "drizzle-orm";
import { t } from "elysia";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import {
  bookings as bookingsTable,
  payments as paymentsTable,
} from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";

export const adminListPaymentsSchema = {
  query: t.Object({
    userId:   t.Optional(t.String()),  // filter payments for a specific user
    page:     t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
    search:   t.Optional(t.String()),  // ILIKE on name, phone, txn id, booking ref
    status:   t.Optional(t.String()),  // exact match on payments.status
    method:   t.Optional(t.String()),  // exact match on payments.paymentMethod
  }),
  detail: {
    tags: ["Payments"],
    operationId: "adminListPayments",
    description: "Admin: list all payments with user and booking details",
  },
};

export const adminListPayments = async ({
  user,
  query,
  set,
}: {
  user: any;
  query: { userId?: string; page?: string; pageSize?: string; search?: string; status?: string; method?: string };
  set: any;
}) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Admin access required", data: null };
  }

  const page     = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
  const offset   = (page - 1) * pageSize;

  logger.info({ module: "payments", action: "admin-list", adminId: user.id, page, pageSize, filterUserId: query.userId }, "Admin fetching all payments");

  const filterConditions = [
    query.userId ? eq(userTable.id, query.userId) : undefined,
    query.status ? eq(paymentsTable.status, query.status as any) : undefined,
    query.method ? eq(paymentsTable.paymentMethod, query.method as any) : undefined,
    query.search
      ? or(
          ilike(userTable.name, `%${query.search}%`),
          ilike(userTable.phoneNumber, `%${query.search}%`),
          ilike(paymentsTable.id, `%${query.search}%`),
          ilike(bookingsTable.bookingRef, `%${query.search}%`),
        )
      : undefined,
  ].filter(Boolean) as any[];

  const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

  const baseQuery = db
    .select({
      id:              paymentsTable.id,
      bookingId:       paymentsTable.bookingId,
      amount:          paymentsTable.amount,
      currency:        paymentsTable.currency,
      status:          paymentsTable.status,
      mode:            paymentsTable.mode,
      paymentMethod:   paymentsTable.paymentMethod,
      paidAt:          paymentsTable.paidAt,
      cashVerifiedAt:  paymentsTable.cashVerifiedAt,
      adminVerifiedAt: paymentsTable.adminVerifiedAt,
      createdAt:       paymentsTable.createdAt,
      bookingRef:      bookingsTable.bookingRef,
      journeyDate:     bookingsTable.journeyDate,
      totalFare:       bookingsTable.totalFare,
      bookingStatus:   bookingsTable.status,
      userName:        userTable.name,
      userPhone:       userTable.phoneNumber,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .innerJoin(userTable, eq(bookingsTable.userId, userTable.id))
    .where(whereClause);

  const [rows, [totalResult], stats, cashStats, pendingStats] = await Promise.all([
    baseQuery.orderBy(desc(paymentsTable.createdAt)).limit(pageSize).offset(offset),
    db
      .select({ value: count() })
      .from(paymentsTable)
      .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
      .innerJoin(userTable, eq(bookingsTable.userId, userTable.id))
      .where(whereClause),
    // Summary stats always global
    db
      .select({ totalRevenue: sum(paymentsTable.amount), totalCount: count(paymentsTable.id) })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "paid")),
    db
      .select({ cashCount: count(paymentsTable.id) })
      .from(paymentsTable)
      .where(eq(paymentsTable.paymentMethod, "cash")),
    db
      .select({ pendingCount: count(paymentsTable.id) })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "created")),
  ]);

  const totalCount = Number(totalResult?.value ?? 0);

  set.status = 200;
  return {
    success: true,
    summary: {
      totalRevenue:      stats[0]?.totalRevenue      ?? "0",
      totalTransactions: stats[0]?.totalCount        ?? 0,
      cashPayments:      cashStats[0]?.cashCount     ?? 0,
      pendingPayments:   pendingStats[0]?.pendingCount ?? 0,
    },
    data: rows,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
};
