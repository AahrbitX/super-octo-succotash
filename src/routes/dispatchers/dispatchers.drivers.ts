import { t } from "elysia";
import { and, asc, eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logging";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { user as usersTable } from "@/db/auth-schema";
import {
  bookings as bookingsTable,
  drivers as driversTable,
  places as placesTable,
} from "@/db/schema";

const AVG_SPEED_KMPH = 40;
const DEFAULT_HOURS = 4;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const dispatcherSuggestedDriversSchema = {
  params: t.Object({
    bookingId: t.String(),
  }),

  query: t.Object({
    search: t.Optional(t.String()),
    vehicleType: t.Optional(t.String()),
    ac: t.Optional(t.String()),
    seats: t.Optional(t.String()),
  }),

  detail: {
    tags: ["Dispatchers"],
    description:
      "List all drivers with optional filters and conflict badge for overlapping rides",
  },
};

export const dispatcherSuggestedDrivers = async ({
  params,
  query,
  set,
}: {
  params: { bookingId: string };
  query: { search?: string; vehicleType?: string; ac?: string; seats?: string };
  set: any;
}) => {
  try {
    const pickupPlace = alias(placesTable, "pickup_place");
    const dropPlace = alias(placesTable, "drop_place");

    // Fetch booking + pickup/drop coordinates for distance-based conflict window
    const [booking] = await db
      .select({
        vehicleType: bookingsTable.vehicleType,
        ac: bookingsTable.ac,
        seats: bookingsTable.members,
        journeyDate: bookingsTable.journeyDate,
        journeyTime: bookingsTable.journeyTime,
        pickupLat: pickupPlace.lat,
        pickupLng: pickupPlace.lng,
        dropLat: dropPlace.lat,
        dropLng: dropPlace.lng,
      })
      .from(bookingsTable)
      .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
      .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))
      .where(eq(bookingsTable.id, params.bookingId))
      .limit(1);

    if (!booking) {
      set.status = 404;
      return { message: "Booking not found" };
    }

    // Compute ride window: haversine distance × 2 (up + return) / avg speed
    const pLat = Number(booking.pickupLat);
    const pLng = Number(booking.pickupLng);
    const dLat = Number(booking.dropLat);
    const dLng = Number(booking.dropLng);
    const hasCoords = pLat && pLng && dLat && dLng;

    const distanceKm = hasCoords ? haversineKm(pLat, pLng, dLat, dLng) : 0;
    const rideWindowHours = hasCoords
      ? (distanceKm / AVG_SPEED_KMPH) * 2
      : DEFAULT_HOURS;

    // --- Build optional filter conditions ---
    const conditions: any[] = [];

    if (query.vehicleType) {
      conditions.push(eq(driversTable.vehicleType, query.vehicleType as any));
    }

    if (query.ac !== undefined && query.ac !== "") {
      conditions.push(eq(driversTable.ac, query.ac === "true"));
    }

    if (query.search?.trim()) {
      conditions.push(
        sql`(
        ${usersTable.name} ILIKE ${`%${query.search}%`}
        OR ${driversTable.vehicleNumber} ILIKE ${`%${query.search}%`}
      )`,
      );
    }

    // --- Inline conflict check via EXISTS subquery (1 query instead of 2) ---
    // Cast status::text so PostgreSQL doesn't choke on enum-vs-text comparison
    const drivers = await db
      .select({
        id: driversTable.id,
        name: usersTable.name,
        phone: usersTable.phoneNumber,
        vehicleType: driversTable.vehicleType,
        ac: driversTable.ac,
        vehicleNumber: driversTable.vehicleNumber,
        isAvailable: driversTable.isAvailable,
        hasConflict: sql<boolean>`EXISTS (
        SELECT 1 FROM ${bookingsTable} AS conflict_check
        WHERE conflict_check.driver_id = ${driversTable.id}
          AND conflict_check.journey_date = ${booking.journeyDate}
          AND conflict_check.status::text = ANY(ARRAY['pending','confirmed','ongoing'])
          AND conflict_check.id != ${params.bookingId}
          AND ABS(EXTRACT(EPOCH FROM (
            conflict_check.journey_time::time - ${booking.journeyTime}::time
          )) / 3600.0) < ${rideWindowHours}
      )`,
      })
      .from(driversTable)
      .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(usersTable.name));

    const result = drivers.map((d) => ({
      id: d.id,
      name: d.name ?? "",
      phone: d.phone ?? "",
      vehicleType: d.vehicleType,
      ac: d.ac,
      vehicleNumber: d.vehicleNumber,
      isAvailable: d.isAvailable,
      hasConflict: Boolean(d.hasConflict),
      etaMin: 0,
    }));

    return {
      // Return booking's requirements as suggested filter defaults for the UI
      filters: {
        vehicleType: booking.vehicleType,
        ac: booking.ac,
        seats: booking.seats,
      },
      data: result,
    };
  } catch (error: any) {
    logger.error(
      {
        module: "dispatchers",
        action: "suggested_drivers",
        bookingId: params.bookingId,
        error: error.message,
        detail: error.detail,
      },
      "Failed to fetch suggested drivers",
    );
    set.status = 500;
    return { success: false, message: "Failed to load drivers" };
  }
};
