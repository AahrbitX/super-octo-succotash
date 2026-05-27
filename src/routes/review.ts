import Elysia, { t } from "elysia";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { bookings as bookingsTable, reviews as reviewsTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";

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

      // Verify the booking belongs to this user and is completed
      const booking = await db
        .select({ id: bookingsTable.id, userId: bookingsTable.userId, status: bookingsTable.status, qrToken: bookingsTable.qrToken })
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

      // Upsert: replace existing review if already submitted
      const existing = await db
        .select({ id: reviewsTable.id })
        .from(reviewsTable)
        .where(eq(reviewsTable.bookingId, bookingId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(reviewsTable)
          .set({ rating, comment: comment ?? null, submittedAt: new Date() })
          .where(eq(reviewsTable.bookingId, bookingId));
      } else {
        await db.insert(reviewsTable).values({
          bookingId,
          qrToken: booking[0].qrToken,
          rating,
          comment: comment ?? null,
          submittedAt: new Date(),
        });
      }

      logger.info({ module: "reviews", action: "submit", bookingId, userId: user.id, rating }, "Review submitted");

      return { success: true, message: "Review submitted" };
    },
    {
      body: t.Object({
        bookingId: t.String(),
        rating: t.Number({ minimum: 1, maximum: 5 }),
        comment: t.Optional(t.String()),
      }),
    },
  );
