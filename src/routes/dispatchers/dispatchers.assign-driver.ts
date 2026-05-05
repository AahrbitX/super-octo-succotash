// src/routes/dispatchers/dispatchers.assign-driver.ts
import { t } from "elysia";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { logger } from "@/lib/logging";

import {
  bookings as bookingsTable,
  drivers as driversTable,
} from "@/db/schema";

export const dispatcherAssignDriverSchema = {
  params: t.Object({
    bookingId: t.String(),
  }),
  body: t.Object({
    driverId: t.String(),
  }),
  detail: {
    tags: ["Dispatchers"],
    description: "",
  },
};

export const dispatcherAssignDriver = async ({
  params,
  body,
  user,
  set,
}: {
  params: { bookingId: string };
  body: { driverId: string };
  user: any;
  set: any;
}) => {
  const result = await db.transaction(async (tx) => {
    const [driver] = await tx
      .select()
      .from(driversTable)
      .where(eq(driversTable.id, body.driverId))
      .limit(1);

    if (!driver || !driver.isAvailable) {
      throw new Error("Driver unavailable");
    }

    const [booking] = await tx
      .update(bookingsTable)
      .set({
        driverId: body.driverId,
        status: "confirmed",
      })
      .where(
        and(
          eq(bookingsTable.id, params.bookingId),
          isNull(bookingsTable.driverId),
        ),
      )
      .returning();

    if (!booking) {
      throw new Error("Booking already assigned");
    }

    await tx
      .update(driversTable)
      .set({
        isAvailable: false,
      })
      .where(eq(driversTable.id, body.driverId));

    return booking;
  });

  logger.info(
    {
      module: "dispatchers",
      action: "assign_driver",
      bookingId: params.bookingId,
      driverId: body.driverId,
      assignedBy: user.id,
    },
    "Driver assigned successfully",
  );

  set.status = 200;

  return {
    success: true,
    message: "Driver assigned successfully",
    data: result,
  };
};
