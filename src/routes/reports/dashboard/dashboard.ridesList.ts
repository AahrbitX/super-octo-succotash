import { t } from "elysia";
import { db } from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql, and } from "drizzle-orm";

import {
  bookings as bookingsTable,
  drivers as driversTable,
  places as placesTable,
} from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

export const dashboardRidesListSchema = {
  query: t.Object({
    date: t.Optional(t.String()),
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

  const conditions = [];

  if (query.date) {
    conditions.push(sql`DATE(${bookingsTable.createdAt}) = ${query.date}`);
  }

  const data = await db
    .select({
      id: bookingsTable.id,

      rider: sql<string>`
        COALESCE(
          ${usersTable.name},
          ${bookingsTable.customerName}
        )
      `,

      driver: driverUsers.name,

      route: sql<{
        pickup: string;
        drop: string;
      }>`
        json_build_object(
          'pickup', ${pickupPlace.name},
          'drop', ${dropPlace.name}
        )
      `,

      vehicle: bookingsTable.vehicleType,

      fare: bookingsTable.totalFare,

      time: bookingsTable.createdAt,

      status: bookingsTable.status,
    })
    .from(bookingsTable)

    // rider
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))

    // driver
    .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
    .leftJoin(driverUsers, eq(driversTable.userId, driverUsers.id))

    // places
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))

    .where(conditions.length ? and(...conditions) : undefined)

    .orderBy(desc(bookingsTable.createdAt))
    .limit(20); // dashboard cap

  return {
    rides: data,
  };
};
