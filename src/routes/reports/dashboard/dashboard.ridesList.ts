import { t } from "elysia";
import { db } from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql, and, count, ilike, or, gte, lt } from "drizzle-orm";

import {
  bookings as bookingsTable,
  drivers as driversTable,
  places as placesTable,
} from "@/db/schema";

import { user as usersTable } from "@/db/auth-schema";

export const dashboardRidesListSchema = {
  query: t.Object({
    date: t.Optional(t.String()),
    search: t.Optional(t.String()),
    status: t.Optional(t.String()),
    page: t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
  }),

  detail: {
    tags: ["Reports"],
    description: "Dashboard rides overview for selected date",
  },
};

export const dashboardRidesList = async ({
  query,
}: {
  query: (typeof dashboardRidesListSchema)["query"]["static"];
}) => {
  const driverUsers = alias(usersTable, "driver_users");
  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace = alias(placesTable, "drop_place");

  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (query.date) {
    // Use range instead of DATE() so the createdAt index is used
    const dayStart = new Date(`${query.date}T00:00:00.000Z`);
    const dayEnd = new Date(`${query.date}T23:59:59.999Z`);
    conditions.push(gte(bookingsTable.createdAt, dayStart));
    conditions.push(lt(bookingsTable.createdAt, dayEnd));
  }

  if (query.status) {
    conditions.push(eq(bookingsTable.status, query.status as any));
  }

  if (query.search) {
    conditions.push(
      or(
        ilike(usersTable.name, `%${query.search}%`),
        ilike(bookingsTable.customerName, `%${query.search}%`),
        ilike(driverUsers.name, `%${query.search}%`),
      ),
    );
  }

  const whereCondition = conditions.length ? and(...conditions) : undefined;

  const [rides, [countResult], ridesStatus] = await Promise.all([
    db
      .select({
        id: bookingsTable.id,
        rider: sql<string>`COALESCE(${usersTable.name}, ${bookingsTable.customerName})`,
        driver: driverUsers.name,
        route: sql<{ pickup: string; drop: string }>`
          json_build_object(
            'pickup', ${pickupPlace.name},
            'drop',   ${dropPlace.name}
          )
        `,
        vehicle: bookingsTable.vehicleType,
        fare: bookingsTable.totalFare,
        time: bookingsTable.createdAt,
        status: bookingsTable.status,
      })
      .from(bookingsTable)
      .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
      .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
      .leftJoin(driverUsers, eq(driversTable.userId, driverUsers.id))
      .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
      .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))
      .where(whereCondition)
      .orderBy(desc(bookingsTable.createdAt))
      .limit(pageSize)
      .offset(offset),

    // Only add user/driver joins to count when search references those tables
    query.search
      ? db
          .select({ value: count() })
          .from(bookingsTable)
          .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
          .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
          .leftJoin(driverUsers, eq(driversTable.userId, driverUsers.id))
          .where(whereCondition)
      : db.select({ value: count() }).from(bookingsTable).where(whereCondition),

    db
      .select({ status: bookingsTable.status, count: count() })
      .from(bookingsTable)
      .groupBy(bookingsTable.status),
  ]);

  const totalCount = countResult?.value ?? 0;

  const statusMap = {
    pending: 0,
    confirmed: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
  };
  ridesStatus.forEach((item) => {
    if (item.status in statusMap)
      statusMap[item.status as keyof typeof statusMap] = Number(item.count);
  });

  return {
    rides,
    ridesStatus: statusMap,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
};
