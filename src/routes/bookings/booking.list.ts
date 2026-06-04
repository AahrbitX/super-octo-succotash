import { db } from "@/db";
import { logger } from "@/lib/logging";

import { t } from "elysia";
import { and, count, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { user as usersTable } from "@/db/auth-schema";

import {
  bookings as bookingsTable,
  drivers as driversTable,
  places as placesTable,
  reviews as reviewsTable,
  payments as paymentsTable,
} from "@/db/schema";

export const bookingListSchema = {
  query: t.Object({
    page:     t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
    userId:   t.Optional(t.String()), // admin: filter bookings for a specific user
    driverId: t.Optional(t.String()), // admin: filter bookings for a specific driver
    search:   t.Optional(t.String()), // admin: search by bookingRef
    status:   t.Optional(t.String()), // admin: filter by booking status
    dateFrom: t.Optional(t.String()), // admin: journeyDate >= dateFrom
    dateTo:   t.Optional(t.String()), // admin: journeyDate <= dateTo
  }),
  detail: {
    tags: ["Bookings"],
    description: "List all the bookings with pagination for datatable",
  },
};

const bookingList = async ({
  user,
  query,
}: {
  user: any;
  query: (typeof bookingListSchema)["query"]["static"];
}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 100);

  const offset = (page - 1) * pageSize;

  const isAdmin = user.role === "admin";

  logger.info(
    {
      module: "bookings",
      action: "list",
      userId: user.id,
      role: user.role,
      scope: isAdmin ? "all" : "own",
      page,
      pageSize,
      offset,
    },
    "Fetching bookings list",
  );

  /**
   * Need users table twice:
   *
   * 1. Booking customer user profile
   * 2. Driver user profile
   *
   * So alias second join
   */
  const driverUsers = alias(usersTable, "driver_users");
  const pickupPlaces = alias(placesTable, "pickup_places");
  const dropPlaces = alias(placesTable, "drop_places");

  const baseCondition = isAdmin
    ? query.driverId
      ? eq(bookingsTable.driverId, query.driverId)
      : query.userId
        ? eq(bookingsTable.userId, query.userId)
        : undefined
    : eq(bookingsTable.userId, user.id);

  const filterConditions = [
    baseCondition,
    query.search   ? ilike(bookingsTable.bookingRef, `%${query.search}%`) : undefined,
    query.status   ? eq(bookingsTable.status, query.status as any)        : undefined,
    query.dateFrom ? gte(bookingsTable.journeyDate, query.dateFrom)       : undefined,
    query.dateTo   ? lte(bookingsTable.journeyDate, query.dateTo)         : undefined,
  ].filter(Boolean) as any[];

  const whereCondition = filterConditions.length > 0 ? and(...filterConditions) : undefined;

  const dataQuery = db
    .select({
      id: bookingsTable.id,
      bookingRef: bookingsTable.bookingRef,
      rider: sql<string>`
        COALESCE(
          ${usersTable.name},
          ${bookingsTable.customerName}
        )
      `,
      bookingDate: bookingsTable.createdAt,
      driver: driverUsers.name,
      driverPhone: driverUsers.phoneNumber,
      source: bookingsTable.source,
      driverId: bookingsTable.driverId,
      status: bookingsTable.status,
      fare: bookingsTable.totalFare,
      pickupName: pickupPlaces.name,
      dropName: dropPlaces.name,
      journeyDate: bookingsTable.journeyDate,
      journeyTime: bookingsTable.journeyTime,
      vehicleType:     bookingsTable.vehicleType,
      tripType:        bookingsTable.tripType,
      legType:         bookingsTable.legType,
      linkedBookingId: bookingsTable.linkedBookingId,
      rating: reviewsTable.rating,
        // Latest payment fields — resolved via DISTINCT ON lateral join (replaces 4 correlated subqueries)
      payMode:   sql<string>`latest_pay.mode`,
      payStatus: sql<string>`latest_pay.status`,
      payId:     sql<string>`latest_pay.pay_id`,
      payAmount: sql<string>`COALESCE(pay_sum.pay_amount, '0')`,
    })
    .from(bookingsTable)

    /**
     * If booking belongs to registered user
     */
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))

    /**
     * Booking.driverId -> drivers.id
     */
    .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))

    /**
     * drivers.userId -> user.id
     */
    .leftJoin(driverUsers, eq(driversTable.userId, driverUsers.id))

    /**
     * Pickup and drop place names
     */
    .leftJoin(pickupPlaces, eq(bookingsTable.pickupId, pickupPlaces.id))
    .leftJoin(dropPlaces, eq(bookingsTable.dropId, dropPlaces.id))
    .leftJoin(reviewsTable, eq(bookingsTable.id, reviewsTable.bookingId))
    // Single DISTINCT ON join replaces 4 correlated subqueries — massive speedup
    .leftJoin(
      sql`(
        SELECT DISTINCT ON (booking_id)
          booking_id, mode, status, id AS pay_id
        FROM payments
        ORDER BY booking_id, created_at DESC
      ) AS latest_pay`,
      sql`latest_pay.booking_id = ${bookingsTable.id}`,
    )
    .leftJoin(
      sql`(
        SELECT booking_id, COALESCE(SUM(amount), 0)::text AS pay_amount
        FROM payments
        WHERE status IN ('paid', 'cash_collected')
        GROUP BY booking_id
      ) AS pay_sum`,
      sql`pay_sum.booking_id = ${bookingsTable.id}`,
    )

    .where(whereCondition)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  const countQuery = db
    .select({ value: count() })
    .from(bookingsTable)
    .where(whereCondition);

  const [data, [total]] = await Promise.all([dataQuery, countQuery]);

  const totalCount = Number(total?.value ?? 0);

  logger.info(
    {
      module: "bookings",
      action: "list",
      userId: user.id,
      role: user.role,
      scope: isAdmin ? "all" : "own",
      resultCount: data.length,
      totalCount,
    },
    "Bookings fetched successfully",
  );

  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
};

export { bookingList };
