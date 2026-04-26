import { t } from "elysia";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { logger } from "@/lib/logging";

import { bookings as bookingsTable, places as placesTable } from "@/db/schema";

const pickupPlaceTable = alias(placesTable, "pickup_place");
const dropPlaceTable = alias(placesTable, "drop_place");

export const dispatchersListSchema = {
  query: t.Object({
    limit: t.Optional(t.String()),
  }),
};

export const dispatchersList = async ({
  query,
}: {
  query: (typeof dispatchersListSchema)["query"]["static"];
}) => {
  const limit = Number(query.limit) || 25;

  logger.info(
    {
      module: "dispatchers",
      action: "queue",
      limit,
    },
    "Fetching unassigned trips queue",
  );

  const data = await db
    .select({
      id: bookingsTable.id,
      bookingRef: bookingsTable.bookingRef,

      customerName: bookingsTable.customerName,

      vehicleType: bookingsTable.vehicleType,
      ac: bookingsTable.ac,
      seats: bookingsTable.members,

      pickupId: bookingsTable.pickupId,
      pickupName: pickupPlaceTable.name,
      pickupZone: pickupPlaceTable.zone,

      dropId: bookingsTable.dropId,
      dropName: dropPlaceTable.name,
      dropZone: dropPlaceTable.zone,

      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
    })
    .from(bookingsTable)
    .leftJoin(pickupPlaceTable, eq(bookingsTable.pickupId, pickupPlaceTable.id))
    .leftJoin(dropPlaceTable, eq(bookingsTable.dropId, dropPlaceTable.id))
    .where(
      and(isNull(bookingsTable.driverId), eq(bookingsTable.status, "pending")),
    )
    .orderBy(desc(bookingsTable.createdAt))
    .limit(limit);

  logger.info(
    {
      module: "dispatchers",
      action: "queue",
      resultCount: data.length,
    },
    "Unassigned trips fetched successfully",
  );

  return {
    data,
  };
};
