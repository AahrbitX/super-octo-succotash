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
    pickupLat: t.Optional(t.Number()),
    pickupLng: t.Optional(t.Number()),
    dropName: t.String(),
    dropZone: t.String(),
    dropLat: t.Optional(t.Number()),
    dropLng: t.Optional(t.Number()),
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
  detail: {
    tags: ["Bookings"],
    operationId: "createBooking",
    description: "",
  },
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
      pickupLat,
      pickupLng,

      dropName,
      dropZone,
      dropLat,
      dropLng,

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
      logger.info({ requestId, module: "bookings", step: "create_pickup_place", placeName: pickupName }, "Pickup place not found. Creating new place");
      [pickup] = await db
        .insert(placesTable)
        .values({
          id: generatePlaceId(),
          name: pickupName,
          zone: pickupZone,
          lat: pickupLat != null ? String(pickupLat) : null,
          lng: pickupLng != null ? String(pickupLng) : null,
        })
        .returning();
      if (!pickup) throw new Error("Unable to create pickup location");
    } else if (pickupLat != null && pickupLng != null && (pickup.lat == null || pickup.lng == null)) {
      // Backfill coordinates on an existing place that had none — id unchanged
      await db
        .update(placesTable)
        .set({ lat: String(pickupLat), lng: String(pickupLng) })
        .where(eq(placesTable.id, pickup.id));
    }

    let [drop] = await db
      .select()
      .from(placesTable)
      .where(eq(placesTable.name, dropName))
      .limit(1);

    if (!drop) {
      logger.info({ requestId, module: "bookings", step: "create_drop_place", placeName: dropName }, "Drop place not found. Creating new place");
      [drop] = await db
        .insert(placesTable)
        .values({
          id: generatePlaceId(),
          name: dropName,
          zone: dropZone,
          lat: dropLat != null ? String(dropLat) : null,
          lng: dropLng != null ? String(dropLng) : null,
        })
        .returning();
      if (!drop) throw new Error("Unable to create drop location");
    } else if (dropLat != null && dropLng != null && (drop.lat == null || drop.lng == null)) {
      await db
        .update(placesTable)
        .set({ lat: String(dropLat), lng: String(dropLng) })
        .where(eq(placesTable.id, drop.id));
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
