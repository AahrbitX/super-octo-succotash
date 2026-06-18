// src/routes/public-review.ts
// Public review form endpoints — no auth required (accessed via booking qrToken)
import Elysia, { t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, reviews as reviewsTable, drivers as driversTable, places as placesTable } from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

export const publicReviewRouter = new Elysia({ prefix: "/review" })
  .use(rateLimit({ max: 20, duration: 60_000 }))

  /**
   * GET /api/review/:token
   * Returns the booking info needed to render the review form.
   * Returns 404 if booking not found, not completed, or already reviewed.
   */
  .get("/:token", async ({ params, set }) => {
    const pickupPlace = alias(placesTable, "pickup_place");
    const dropPlace   = alias(placesTable, "drop_place");

    const [booking] = await db
      .select({
        id:           bookingsTable.id,
        bookingRef:   bookingsTable.bookingRef,
        status:       bookingsTable.status,
        customerName: bookingsTable.customerName,
        journeyDate:  bookingsTable.journeyDate,
        journeyTime:  bookingsTable.journeyTime,
        pickupName:   pickupPlace.name,
        dropName:     dropPlace.name,
        driverId:     bookingsTable.driverId,
      })
      .from(bookingsTable)
      .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
      .leftJoin(dropPlace,   eq(bookingsTable.dropId,   dropPlace.id))
      .where(eq(bookingsTable.qrToken, params.token))
      .limit(1);

    if (!booking) {
      set.status = 404;
      return { success: false, message: "Booking not found" };
    }

    if (booking.status !== "completed") {
      set.status = 400;
      return { success: false, message: "Reviews can only be submitted for completed rides" };
    }

    // Check if already reviewed
    const [existing] = await db
      .select({ id: reviewsTable.id })
      .from(reviewsTable)
      .where(eq(reviewsTable.bookingId, booking.id))
      .limit(1);

    if (existing) {
      set.status = 400;
      return { success: false, message: "A review has already been submitted for this ride" };
    }

    // Get driver name if assigned
    let driverName: string | null = null;
    if (booking.driverId) {
      const [driver] = await db
        .select({ name: usersTable.name })
        .from(driversTable)
        .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
        .where(eq(driversTable.id, booking.driverId))
        .limit(1);
      driverName = driver?.name ?? null;
    }

    return {
      success: true,
      data: {
        bookingRef:   booking.bookingRef,
        customerName: booking.customerName,
        journeyDate:  booking.journeyDate,
        journeyTime:  booking.journeyTime,
        pickupName:   booking.pickupName ?? "—",
        dropName:     booking.dropName   ?? "—",
        driverName,
      },
    };
  })

  /**
   * POST /api/review/submit
   * Submit a review via qrToken (no auth required).
   */
  .post(
    "/submit",
    async ({ body, set }) => {
      const [booking] = await db
        .select({ id: bookingsTable.id, bookingRef: bookingsTable.bookingRef, status: bookingsTable.status, qrToken: bookingsTable.qrToken })
        .from(bookingsTable)
        .where(eq(bookingsTable.qrToken, body.token))
        .limit(1);

      if (!booking) {
        set.status = 404;
        return { success: false, message: "Booking not found" };
      }

      if (booking.status !== "completed") {
        set.status = 400;
        return { success: false, message: "Reviews can only be submitted for completed rides" };
      }

      // Check duplicate
      const [existing] = await db
        .select({ id: reviewsTable.id })
        .from(reviewsTable)
        .where(eq(reviewsTable.bookingId, booking.id))
        .limit(1);

      if (existing) {
        set.status = 409;
        return { success: false, message: "A review has already been submitted for this ride" };
      }

      await db.insert(reviewsTable).values({
        bookingId:          booking.id,
        qrToken:            booking.qrToken as any,
        rating:             body.rating,
        comment:            body.comment ?? null,
        ratingPunctuality:  body.ratingPunctuality ?? null,
        ratingCleanliness:  body.ratingCleanliness ?? null,
        ratingBehavior:     body.ratingBehavior    ?? null,
        ratingDriving:      body.ratingDriving     ?? null,
      });

      logger.info({ module: "reviews", action: "public_submit", bookingId: booking.id }, "Review submitted via public form");

      set.status = 201;
      return { success: true, message: "Thank you for your review!" };
    },
    {
      body: t.Object({
        token:              t.String(),
        rating:             t.Number({ minimum: 1, maximum: 5 }),
        comment:            t.Optional(t.String()),
        ratingPunctuality:  t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        ratingCleanliness:  t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        ratingBehavior:     t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        ratingDriving:      t.Optional(t.Number({ minimum: 1, maximum: 5 })),
      }),
    },
  );
