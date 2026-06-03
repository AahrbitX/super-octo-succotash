import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable } from "@/db/schema";

export const driverEndRideSchema = {
  params: t.Object({ token: t.String() }),
};

export const driverEndRide = async ({
  params,
  set,
}: {
  params: { token: string };
  set: any;
}) => {
  const { token } = params;

  const [booking] = await db
    .select({ id: bookingsTable.id, status: bookingsTable.status, bookingRef: bookingsTable.bookingRef })
    .from(bookingsTable)
    .where(eq(bookingsTable.qrToken, token))
    .limit(1);

  if (!booking) {
    set.status = 404;
    return { success: false, message: "Ride not found" };
  }

  if (booking.status !== "ongoing") {
    set.status = 400;
    return {
      success: false,
      message:
        booking.status === "completed"
          ? "Ride already ended"
          : `Ride cannot be ended — status is "${booking.status}"`,
    };
  }

  await db
    .update(bookingsTable)
    .set({ status: "completed", rideEndedAt: new Date(), updatedAt: new Date() })
    .where(eq(bookingsTable.id, booking.id));

  logger.info(
    { module: "driver", action: "end_ride", bookingId: booking.id, bookingRef: booking.bookingRef },
    "Ride ended by driver",
  );

  return { success: true, message: "Ride ended" };
};
