// src/routes/bookings/booking.request-review.ts
import { t } from "elysia";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { logger } from "@/lib/logging";
import { requireAdmin } from "@/lib/guards";
import { sendReviewRequest } from "@/lib/whatsapp";
import { bookings as bookingsTable, reviews as reviewsTable } from "@/db/schema";

export const requestReviewSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Bookings"],
    description: "Admin: send a review request WhatsApp message to the customer for a completed ride",
  },
};

export const requestReview = async ({
  params,
  user,
  set,
}: {
  params: { id: string };
  user: any;
  set: any;
}) => {
  requireAdmin({ user, set } as any);

  const [booking] = await db
    .select({
      id:            bookingsTable.id,
      bookingRef:    bookingsTable.bookingRef,
      status:        bookingsTable.status,
      customerName:  bookingsTable.customerName,
      customerPhone: bookingsTable.customerPhone,
      qrToken:       bookingsTable.qrToken,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.id))
    .limit(1);

  if (!booking) {
    set.status = 404;
    return { success: false, message: "Booking not found" };
  }

  if (booking.status !== "completed") {
    set.status = 400;
    return { success: false, message: "Review requests can only be sent for completed rides" };
  }

  // Check if review already exists
  const [existing] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(eq(reviewsTable.bookingId, params.id))
    .limit(1);

  if (existing) {
    set.status = 400;
    return { success: false, message: "A review has already been submitted for this ride" };
  }

  await sendReviewRequest({
    phone:        booking.customerPhone,
    customerName: booking.customerName,
    bookingRef:   booking.bookingRef,
    qrToken:      booking.qrToken,
  });

  logger.info(
    { module: "bookings", action: "request_review", bookingId: params.id, sentBy: user.id },
    "Review request sent",
  );

  set.status = 200;
  return { success: true, message: "Review request sent via WhatsApp" };
};
