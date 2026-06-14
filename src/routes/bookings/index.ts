import Elysia from "elysia";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";

import { bookingList, bookingListSchema } from "./booking.list";
import { createBooking, createBookingSchema } from "./booking.create";
import { searchBooking, searchBookingSchema } from "./booking.search";
import { bookingDetails, bookingDetailsSchema } from "./bookings.details";
import { cancelBooking, cancelBookingSchema } from "./booking.cancel";
import { completeBooking, completeBookingSchema } from "./booking.complete";

export const bookingsRouter = new Elysia({ prefix: "/bookings" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session) {
      logger.warn(
        {
          module: "bookings",
          action: "auth",
          status: 401,
        },
        "Unauthorized access attempt",
      );
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .get("/", bookingList, bookingListSchema)
  .get("/search", searchBooking, searchBookingSchema)
  .get("/:id", bookingDetails, bookingDetailsSchema)
  .post("/create", createBooking, createBookingSchema)
  .patch("/:id/cancel", cancelBooking, cancelBookingSchema)
  .patch("/:id/complete", completeBooking, completeBookingSchema);
