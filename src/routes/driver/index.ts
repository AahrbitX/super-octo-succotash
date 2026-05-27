import Elysia from "elysia";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings as bookingsTable, places as placesTable } from "@/db/schema";
import { logger } from "@/lib/logging";

const pickupPlace = alias(placesTable, "pickup_place");
const dropPlace = alias(placesTable, "drop_place");

export const driverRouter = new Elysia({ prefix: "/driver" })

  /** GET /api/driver/:token — public, returns ride details for the driver */
  .get("/:token", async ({ params, set }) => {
    const rows = await db
      .select({
        id: bookingsTable.id,
        bookingRef: bookingsTable.bookingRef,
        status: bookingsTable.status,
        customerName: bookingsTable.customerName,
        customerPhone: bookingsTable.customerPhone,
        journeyDate: bookingsTable.journeyDate,
        journeyTime: bookingsTable.journeyTime,
        totalFare: bookingsTable.totalFare,
        vehicleType: bookingsTable.vehicleType,
        ac: bookingsTable.ac,
        members: bookingsTable.members,
        pickupName: pickupPlace.name,
        dropName: dropPlace.name,
      })
      .from(bookingsTable)
      .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
      .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))
      .where(eq(bookingsTable.qrToken, params.token))
      .limit(1);

    if (!rows[0]) {
      set.status = 404;
      return { success: false, message: "Ride not found" };
    }

    const b = rows[0];
    return {
      success: true,
      data: {
        id: b.id,
        bookingRef: b.bookingRef,
        status: b.status,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        journeyDate: b.journeyDate,
        journeyTime: b.journeyTime,
        totalFare: b.totalFare,
        vehicleType: b.vehicleType,
        ac: b.ac,
        members: b.members,
        pickupName: b.pickupName ?? "—",
        dropName: b.dropName ?? "—",
      },
    };
  })

  /** PATCH /api/driver/:token/start — public, driver starts the ride */
  .patch("/:token/start", async ({ params, set }) => {
    const rows = await db
      .select({ id: bookingsTable.id, status: bookingsTable.status, bookingRef: bookingsTable.bookingRef })
      .from(bookingsTable)
      .where(eq(bookingsTable.qrToken, params.token))
      .limit(1);

    if (!rows[0]) {
      set.status = 404;
      return { success: false, message: "Ride not found" };
    }

    if (rows[0].status !== "confirmed") {
      set.status = 400;
      return {
        success: false,
        message:
          rows[0].status === "ongoing"
            ? "Ride already started"
            : `Ride cannot be started — status is "${rows[0].status}"`,
      };
    }

    await db
      .update(bookingsTable)
      .set({ status: "ongoing", rideStartedAt: new Date(), updatedAt: new Date() })
      .where(eq(bookingsTable.id, rows[0].id));

    logger.info(
      { module: "driver", action: "start_ride", bookingId: rows[0].id, bookingRef: rows[0].bookingRef },
      "Ride started by driver",
    );

    return { success: true, message: "Ride started" };
  });
