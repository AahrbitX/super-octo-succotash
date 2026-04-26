import { db } from "@/db";
import { logger } from "@/lib/logging";

import { t } from "elysia";
import { eq } from "drizzle-orm";
import { generateBookingId, generatePlaceId } from "@/utils/id";
import { bookings as bookingsTable, places as placesTable } from "@/db/schema";

export const createBookingSchema = {
  body: t.Object({
    customerName: t.String(),
    customerPhone: t.String(),
    source: t.String(),
    pickupName: t.String(),
    pickupZone: t.String(),
    dropName: t.String(),
    dropZone: t.String(),
    journeyDate: t.String(),
    journeyTime: t.String(),
    members: t.Number(),
    vehicleType: t.Union([
      t.Literal("sedan"),
      t.Literal("suv"),
      t.Literal("minivan"),
    ]),
    ac: t.Boolean(),
    totalFare: t.String(),
  }),
};

const createBooking = async ({
  user,
  set,
  body,
}: {
  user: any;
  set: any;
  body: (typeof createBookingSchema)["body"]["static"];
}) => {
  const requestId = crypto.randomUUID();

  logger.info(
    {
      requestId,
      module: "bookings",
      action: "create",
      actorUserId: user.id,
      actorRole: user.role,
      payload: body,
    },
    "Booking creation started",
  );

  try {
    const {
      customerName,
      customerPhone,
      source,

      pickupName,
      pickupZone,

      dropName,
      dropZone,

      journeyDate,
      journeyTime,

      members,
      vehicleType,
      ac,
      totalFare,
    } = body;

    const bookingId = generateBookingId();
    const bookingRef = `BK${Date.now()}`;

    let [pickup] = await db
      .select()
      .from(placesTable)
      .where(eq(placesTable.name, pickupName))
      .limit(1);

    if (!pickup) {
      logger.info(
        {
          requestId,
          module: "bookings",
          step: "create_pickup_place",
          placeName: pickupName,
          zone: pickupZone,
        },
        "Pickup place not found. Creating new place",
      );

      [pickup] = await db
        .insert(placesTable)
        .values({
          id: generatePlaceId(),
          name: pickupName,
          zone: pickupZone,
        })
        .returning();

      if (!pickup) {
        logger.error(
          {
            requestId,
            module: "bookings",
            step: "create_pickup_place",
            placeName: pickupName,
          },
          "Failed to create pickup place",
        );

        throw new Error("Unable to create pickup location");
      }
    }

    let [drop] = await db
      .select()
      .from(placesTable)
      .where(eq(placesTable.name, dropName))
      .limit(1);

    if (!drop) {
      logger.info(
        {
          requestId,
          module: "bookings",
          step: "create_drop_place",
          placeName: dropName,
          zone: dropZone,
        },
        "Drop place not found. Creating new place",
      );

      [drop] = await db
        .insert(placesTable)
        .values({
          id: generatePlaceId(),
          name: dropName,
          zone: dropZone,
        })
        .returning();

      if (!drop) {
        logger.error(
          {
            requestId,
            module: "bookings",
            step: "create_drop_place",
            placeName: dropName,
          },
          "Failed to create drop place",
        );

        throw new Error("Unable to create drop location");
      }
    }

    const linkedUserId = source === "self" ? user.id : null;

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        id: bookingId,
        bookingRef,
        userId: linkedUserId,
        bookedByUserId: user.id,
        customerName,
        customerPhone,
        source,
        pickupId: pickup.id,
        dropId: drop.id,
        journeyDate,
        journeyTime,
        members,
        vehicleType,
        ac,
        totalFare,
        qrExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      })
      .returning();

    if (!booking) {
      logger.error(
        {
          requestId,
          module: "bookings",
          action: "create",
          bookingId,
        },
        "Booking insert failed",
      );

      throw new Error("Unable to create booking");
    }

    logger.info(
      {
        requestId,
        module: "bookings",
        action: "create",
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        customerPhone,
        source,
        pickupId: pickup.id,
        dropId: drop.id,
      },
      "Booking created successfully",
    );

    set.status = 201;

    return {
      success: true,
      message: "Booking created successfully",
      data: booking,
    };
  } catch (error: any) {
    logger.error(
      {
        requestId,
        module: "bookings",
        action: "create",
        error: error.message,
      },
      "Booking creation failed",
    );

    set.status = 400;

    return {
      success: false,
      message: error.message || "Failed to create booking",
    };
  }
};

export { createBooking };
