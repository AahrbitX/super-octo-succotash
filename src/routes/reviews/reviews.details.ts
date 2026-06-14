import { t } from "elysia";
import { db } from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { eq, desc, avg, count, inArray } from "drizzle-orm";

import {
  bookings as bookingsTable,
  reviews as reviewsTable,
  places as placesTable,
  drivers as driversTable,
} from "@/db/schema";

import { user as userTable } from "@/db/auth-schema";
import { haversineKm } from "@/utils/haversineKM";
import { paginationSchema } from "@/schema/paginationSchema";

export const reviewDetailsSchema = {
  query: t.Object({
    userId: t.Optional(t.String()),
    driverId: t.Optional(t.String()),
    ...paginationSchema,
  }),

  details: {
    tags: ["Reviews"],
    operationId: "review-details",
    description: "",
  },
};

const reviewDetails = async ({
  query,
}: {
  query: (typeof reviewDetailsSchema)["query"]["static"];
}) => {
  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace = alias(placesTable, "drop_place");

  const rows = await db
    .select({
      id: reviewsTable.id,
      bookingId: reviewsTable.bookingId,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      flagged: reviewsTable.flagged,
      unread: reviewsTable.unread,
      ratingPunctuality: reviewsTable.ratingPunctuality,
      ratingCleanliness: reviewsTable.ratingCleanliness,
      ratingBehavior: reviewsTable.ratingBehavior,
      ratingDriving: reviewsTable.ratingDriving,
      submittedAt: reviewsTable.submittedAt,
      bookingRef: bookingsTable.bookingRef,
      journeyDate: bookingsTable.journeyDate,
      customerName: bookingsTable.customerName,
      customerPhone: bookingsTable.customerPhone,
      totalFare: bookingsTable.totalFare,
      vehicleType: bookingsTable.vehicleType,
      ac: bookingsTable.ac,
      driverId: bookingsTable.driverId,
      pickupLocation: pickupPlace.name,
      pickupLat: pickupPlace.lat,
      pickupLng: pickupPlace.lng,
      dropLocation: dropPlace.name,
      dropLat: dropPlace.lat,
      dropLng: dropPlace.lng,
    })
    .from(reviewsTable)
    .innerJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))
    .where(
      query.driverId
        ? eq(bookingsTable.driverId, query.driverId)
        : query.userId
          ? eq(bookingsTable.userId, query.userId)
          : undefined,
    )
    .orderBy(desc(reviewsTable.submittedAt));

  // Resolve driver names + vehicle numbers
  const driverIds = [
    ...new Set(rows.map((r) => r.driverId).filter(Boolean)),
  ] as string[];

  const driverRows = driverIds.length
    ? await db
        .select({
          id: driversTable.id,
          name: userTable.name,
          vehicleNumber: driversTable.vehicleNumber,
        })
        .from(driversTable)
        .innerJoin(userTable, eq(driversTable.userId, userTable.id))
        .where(inArray(driversTable.id, driverIds))
    : [];

  const driverMap = Object.fromEntries(
    driverRows.map((d) => [
      d.id,
      { name: d.name, vehicleNumber: d.vehicleNumber },
    ]),
  );

  const data = rows.map((r) => {
    const pLat = r.pickupLat ? parseFloat(r.pickupLat) : 0;
    const pLng = r.pickupLng ? parseFloat(r.pickupLng) : 0;
    const dLat = r.dropLat ? parseFloat(r.dropLat) : 0;
    const dLng = r.dropLng ? parseFloat(r.dropLng) : 0;
    const distanceKm =
      pLat && pLng && dLat && dLng
        ? Math.round(haversineKm(pLat, pLng, dLat, dLng) * 10) / 10
        : null;

    const driver = r.driverId ? (driverMap[r.driverId] ?? null) : null;

    return {
      id: r.id,
      bookingId: r.bookingId,
      bookingRef: r.bookingRef,
      rating: r.rating,
      comment: r.comment,
      flagged: r.flagged,
      unread: r.unread,
      ratingPunctuality: r.ratingPunctuality ?? null,
      ratingCleanliness: r.ratingCleanliness ?? null,
      ratingBehavior: r.ratingBehavior ?? null,
      ratingDriving: r.ratingDriving ?? null,
      submittedAt: r.submittedAt,
      journeyDate: r.journeyDate,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      pickupLocation: r.pickupLocation ?? "",
      dropLocation: r.dropLocation ?? "",
      totalFare: r.totalFare,
      vehicleType: r.vehicleType,
      ac: r.ac,
      driverName: driver?.name ?? null,
      vehicleNumber: driver?.vehicleNumber ?? null,
      distanceKm,
    };
  });

  return {
    success: true,
    data,
  };
};

export { reviewDetails };
