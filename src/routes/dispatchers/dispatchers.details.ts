// src/routes/dispatchers/dispatchers.details.ts
import { t } from "elysia";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";

import { bookings as bookingsTable, places as placesTable } from "@/db/schema";

const pickupTable = alias(placesTable, "pickup_place");
const dropTable = alias(placesTable, "drop_place");

export const dispatcherTripDetailsSchema = {
  params: t.Object({
    bookingId: t.String(),
  }),

  detail: {
    tags: ["Dispatchers"],
    description: "",
  },
};

export const dispatcherTripDetails = async ({
  params,
  set,
}: {
  params: { bookingId: string };
  set: any;
}) => {
  const [trip] = await db
    .select({
      id: bookingsTable.id,
      bookingRef: bookingsTable.bookingRef,
      customerName: bookingsTable.customerName,
      customerPhone: bookingsTable.customerPhone,
      createdAt: bookingsTable.createdAt,
      journeyDate: bookingsTable.journeyDate,
      journeyTime: bookingsTable.journeyTime,
      vehicleType: bookingsTable.vehicleType,
      ac: bookingsTable.ac,
      seats: bookingsTable.members,
      fare: bookingsTable.totalFare,
      status: bookingsTable.status,
      qrToken: bookingsTable.qrToken,
      driverId: bookingsTable.driverId,

      pickupName: pickupTable.name,
      pickupZone: pickupTable.zone,

      dropName: dropTable.name,
      dropZone: dropTable.zone,
    })
    .from(bookingsTable)
    .leftJoin(pickupTable, eq(bookingsTable.pickupId, pickupTable.id))
    .leftJoin(dropTable, eq(bookingsTable.dropId, dropTable.id))
    .where(eq(bookingsTable.id, params.bookingId))
    .limit(1);

  if (!trip) {
    set.status = 404;
    return { message: "Booking not found" };
  }

  return trip;
};
