import { db } from "@/db";
import { logger } from "@/lib/logging";

import { t } from "elysia";
import { and, count, desc, eq, sql } from "drizzle-orm";
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
    page: t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
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

  const whereCondition = isAdmin
    ? undefined
    : eq(bookingsTable.userId, user.id);

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
      vehicleType: bookingsTable.vehicleType,
      rating: reviewsTable.rating,
      // Latest payment record for mode/status/id (correlated subquery — avoids row duplication from join)
      payMode: sql<string>`(
        SELECT mode FROM payments
        WHERE booking_id = ${bookingsTable.id}
        ORDER BY created_at DESC LIMIT 1
      )`,
      payStatus: sql<string>`(
        SELECT status FROM payments
        WHERE booking_id = ${bookingsTable.id}
        ORDER BY created_at DESC LIMIT 1
      )`,
      // Sum of all confirmed payments — used to detect balance still due
      payAmount: sql<string>`(
        SELECT COALESCE(SUM(amount), 0)::text FROM payments
        WHERE booking_id = ${bookingsTable.id}
        AND status IN ('paid', 'cash_collected')
      )`,
      payId: sql<string>`(
        SELECT id FROM payments
        WHERE booking_id = ${bookingsTable.id}
        ORDER BY created_at DESC LIMIT 1
      )`,
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
