import Elysia, { t } from "elysia";
import { db } from "@/db";
import { eq, desc, avg, count, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  bookings as bookingsTable,
  reviews as reviewsTable,
  places as placesTable,
  drivers as driversTable,
} from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

export const reviewsRouter = new Elysia({ prefix: "/reviews" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .post(
    "/",
    async ({ user, body, set }) => {
      const { bookingId, rating, comment } = body;

      const booking = await db
        .select({
          id: bookingsTable.id,
          userId: bookingsTable.userId,
          status: bookingsTable.status,
          qrToken: bookingsTable.qrToken,
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId))
        .limit(1);

      if (!booking[0]) {
        set.status = 404;
        return { success: false, message: "Booking not found" };
      }

      const isAdmin = (user as any).role === "admin";
      const isOwner = booking[0].userId === user.id;

      if (!isAdmin && !isOwner) {
        set.status = 403;
        return { success: false, message: "Forbidden" };
      }

      if (booking[0].status !== "completed") {
        set.status = 400;
        return { success: false, message: "Can only review completed bookings" };
      }

      const existing = await db
        .select({ id: reviewsTable.id })
        .from(reviewsTable)
        .where(eq(reviewsTable.bookingId, bookingId))
        .limit(1);

      const aspectFields = {
        ratingPunctuality: body.ratingPunctuality ?? null,
        ratingCleanliness: body.ratingCleanliness ?? null,
        ratingBehavior:    body.ratingBehavior    ?? null,
        ratingDriving:     body.ratingDriving     ?? null,
      };

      if (existing[0]) {
        await db
          .update(reviewsTable)
          .set({ rating, comment: comment ?? null, ...aspectFields, submittedAt: new Date() })
          .where(eq(reviewsTable.bookingId, bookingId));
      } else {
        await db.insert(reviewsTable).values({
          bookingId,
          qrToken: booking[0].qrToken,
          rating,
          comment: comment ?? null,
          ...aspectFields,
          submittedAt: new Date(),
        });
      }

      logger.info(
        { module: "reviews", action: "submit", bookingId, userId: user.id, rating },
        "Review submitted",
      );

      return { success: true, message: "Review submitted" };
    },
    {
      body: t.Object({
        bookingId:         t.String(),
        rating:            t.Number({ minimum: 1, maximum: 5 }),
        comment:           t.Optional(t.String()),
        ratingPunctuality: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        ratingCleanliness: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        ratingBehavior:    t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        ratingDriving:     t.Optional(t.Number({ minimum: 1, maximum: 5 })),
      }),
    },
  )
  .get("/admin", async ({ user, query, set }: { user: any; query: { userId?: string; driverId?: string }; set: any }) => {
    if ((user as any).role !== "admin") {
      set.status = 403;
      return { success: false, stats: null, data: [] };
    }

    const pickupPlace = alias(placesTable, "pickup_place");
    const dropPlace   = alias(placesTable, "drop_place");

    const rows = await db
      .select({
        id:                reviewsTable.id,
        bookingId:         reviewsTable.bookingId,
        rating:            reviewsTable.rating,
        comment:           reviewsTable.comment,
        flagged:           reviewsTable.flagged,
        unread:            reviewsTable.unread,
        ratingPunctuality: reviewsTable.ratingPunctuality,
        ratingCleanliness: reviewsTable.ratingCleanliness,
        ratingBehavior:    reviewsTable.ratingBehavior,
        ratingDriving:     reviewsTable.ratingDriving,
        submittedAt:       reviewsTable.submittedAt,
        bookingRef:    bookingsTable.bookingRef,
        journeyDate:   bookingsTable.journeyDate,
        customerName:  bookingsTable.customerName,
        customerPhone: bookingsTable.customerPhone,
        totalFare:     bookingsTable.totalFare,
        vehicleType:   bookingsTable.vehicleType,
        ac:            bookingsTable.ac,
        driverId:      bookingsTable.driverId,
        pickupName:    pickupPlace.name,
        pickupLat:     pickupPlace.lat,
        pickupLng:     pickupPlace.lng,
        dropName:      dropPlace.name,
        dropLat:       dropPlace.lat,
        dropLng:       dropPlace.lng,
      })
      .from(reviewsTable)
      .innerJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
      .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
      .leftJoin(dropPlace,   eq(bookingsTable.dropId,   dropPlace.id))
      .where(
        query.driverId
          ? eq(bookingsTable.driverId, query.driverId)
          : query.userId
            ? eq(bookingsTable.userId, query.userId)
            : undefined
      )
      .orderBy(desc(reviewsTable.submittedAt));

    // Resolve driver names + vehicle numbers
    const driverIds = [...new Set(rows.map((r) => r.driverId).filter(Boolean))] as string[];
    const driverRows = driverIds.length
      ? await db
          .select({ id: driversTable.id, name: userTable.name, vehicleNumber: driversTable.vehicleNumber })
          .from(driversTable)
          .innerJoin(userTable, eq(driversTable.userId, userTable.id))
          .where(inArray(driversTable.id, driverIds))
      : [];
    const driverMap = Object.fromEntries(
      driverRows.map((d) => [d.id, { name: d.name, vehicleNumber: d.vehicleNumber }]),
    );

    // Stats
    const [aggStats] = await db
      .select({ average: avg(reviewsTable.rating), total: count(reviewsTable.id) })
      .from(reviewsTable);

    const distRows = await db
      .select({ rating: reviewsTable.rating, count: count(reviewsTable.id) })
      .from(reviewsTable)
      .groupBy(reviewsTable.rating);

    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      rating: star,
      count: distRows.find((r) => r.rating === star)?.count ?? 0,
    }));

    const data = rows.map((r) => {
      const pLat = r.pickupLat ? parseFloat(r.pickupLat) : 0;
      const pLng = r.pickupLng ? parseFloat(r.pickupLng) : 0;
      const dLat = r.dropLat   ? parseFloat(r.dropLat)   : 0;
      const dLng = r.dropLng   ? parseFloat(r.dropLng)   : 0;
      const distanceKm =
        pLat && pLng && dLat && dLng
          ? Math.round(haversineKm(pLat, pLng, dLat, dLng) * 10) / 10
          : null;

      const driver = r.driverId ? (driverMap[r.driverId] ?? null) : null;

      return {
        id:                r.id,
        bookingId:         r.bookingId,
        bookingRef:        r.bookingRef,
        rating:            r.rating,
        comment:           r.comment,
        flagged:           r.flagged,
        unread:            r.unread,
        ratingPunctuality: r.ratingPunctuality ?? null,
        ratingCleanliness: r.ratingCleanliness ?? null,
        ratingBehavior:    r.ratingBehavior    ?? null,
        ratingDriving:     r.ratingDriving     ?? null,
        submittedAt:       r.submittedAt,
        journeyDate:   r.journeyDate,
        customerName:  r.customerName,
        customerPhone: r.customerPhone,
        pickupName:    r.pickupName ?? "",
        dropName:      r.dropName   ?? "",
        totalFare:     r.totalFare,
        vehicleType:   r.vehicleType,
        ac:            r.ac,
        driverName:    driver?.name     ?? null,
        vehicleNumber: driver?.vehicleNumber ?? null,
        distanceKm,
      };
    });

    return {
      success: true,
      stats: {
        average:      aggStats?.average ? parseFloat(aggStats.average as string) : 0,
        total:        aggStats?.total ?? 0,
        distribution,
        unreadCount:  rows.filter((r) => r.unread).length,
        flaggedCount: rows.filter((r) => r.flagged).length,
      },
      data,
    };
  })
  // PATCH /reviews/:id/flag — toggle flagged
  .patch(
    "/:id/flag",
    async ({ user, params, set }) => {
      if ((user as any).role !== "admin") {
        set.status = 403;
        return { success: false };
      }
      const [row] = await db
        .select({ flagged: reviewsTable.flagged })
        .from(reviewsTable)
        .where(eq(reviewsTable.id, params.id))
        .limit(1);

      if (!row) {
        set.status = 404;
        return { success: false, message: "Review not found" };
      }

      await db
        .update(reviewsTable)
        .set({ flagged: !row.flagged })
        .where(eq(reviewsTable.id, params.id));

      return { success: true, flagged: !row.flagged };
    },
    { params: t.Object({ id: t.String() }) },
  )
  // PATCH /reviews/:id/read — mark as read
  .patch(
    "/:id/read",
    async ({ user, params, set }) => {
      if ((user as any).role !== "admin") {
        set.status = 403;
        return { success: false };
      }
      await db
        .update(reviewsTable)
        .set({ unread: false })
        .where(eq(reviewsTable.id, params.id));

      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  );
