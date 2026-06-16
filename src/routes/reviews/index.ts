import Elysia from "elysia";
import { auth } from "@/lib/auth";

import { flagReview, flagReviewSchema } from "./reviews.flag";
import { readReview, readReviewSchema } from "./reviews.read";
import { reviewStats, reviewStatsSchema } from "./reviews.stats";
import { reviewDetails, reviewDetailsSchema } from "./reviews.details";
import { createBooking, createBookingSchema } from "../bookings/booking.create";

export const reviewsRouter = new Elysia({ prefix: "/reviews" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .get("/", reviewDetails, reviewDetailsSchema)
  .post("/", createBooking, createBookingSchema)
  .get("/stats", reviewStats, reviewStatsSchema)
  .patch("/:id/flag", flagReview, flagReviewSchema)
  .patch("/:id/read", readReview, readReviewSchema);
