import { db } from "@/db";
import { t } from "elysia";
import { logger } from "@/lib/logging";
import { eq } from "drizzle-orm";

import {
  bookings as bookingsTable,
  reviews as reviewsTable,
} from "@/db/schema";

export const createReviewSchema = {
  body: t.Object({
    bookingId: t.String(),
    rating: t.Number({ minimum: 1, maximum: 5 }),
    comment: t.Optional(t.String()),
    ratingPunctuality: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
    ratingCleanliness: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
    ratingBehavior: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
    ratingDriving: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
  }),
  details: {
    tags: ["Reviews"],
    operationId: "create-review",
    description: "",
  },
};

export const createReview = async ({
  user,
  body,
  set,
}: {
  set: any;
  user: any;
  body: (typeof createReviewSchema)["body"]["static"];
}) => {
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
    return {
      success: false,
      message: "Can only review completed bookings",
    };
  }

  const existing = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(eq(reviewsTable.bookingId, bookingId))
    .limit(1);

  const aspectFields = {
    ratingPunctuality: body.ratingPunctuality ?? null,
    ratingCleanliness: body.ratingCleanliness ?? null,
    ratingBehavior: body.ratingBehavior ?? null,
    ratingDriving: body.ratingDriving ?? null,
  };

  if (existing[0]) {
    await db
      .update(reviewsTable)
      .set({
        rating,
        comment: comment ?? null,
        ...aspectFields,
        submittedAt: new Date(),
      })
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
    {
      module: "reviews",
      action: "submit",
      bookingId,
      userId: user.id,
      rating,
    },
    "Review submitted",
  );

  return { success: true, message: "Review submitted" };
};
