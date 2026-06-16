import { db } from "@/db";
import { logger } from "@/lib/logging";
import { sendBookingConfirmation } from "@/lib/whatsapp";

import { t } from "elysia";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateBookingId, generatePlaceId } from "@/utils/id";
import {
  bookings as bookingsTable,
  places as placesTable,
  payments as paymentsTable,
} from "@/db/schema";

export const createBookingSchema = {
  body: t.Object({
    customerName: t.String(),
    customerPhone: t.String(),
    source: t.String(),
    serviceType: t.Optional(t.String()), // 'local' | 'outstation' | 'airport'
    notes: t.Optional(t.String()),
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
    returnDate: t.Optional(t.String()),
    returnTime: t.Optional(t.String()),
    tripType: t.Optional(t.String()), // 'oneway' | 'roundtrip'
    members: t.Number(),
    vehicleType: t.Union([
      t.Literal("hatchback"),
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
  const isRoundTrip =
    body.tripType === "roundtrip" && !!body.returnDate && !!body.returnTime;

  logger.info(
    {
      requestId,
      module: "bookings",
      action: "create",
      actorUserId: user.id,
      actorRole: user.role,
      tripType: isRoundTrip ? "roundtrip" : "oneway",
      payload: body,
    },
    "Booking creation started",
  );

  try {
    const {
      customerName,
      customerPhone,
      source,
      serviceType = "local",
      notes,
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
      returnDate,
      returnTime,
      members,
      vehicleType,
      ac,
      totalFare,
    } = body;

    // ── Resolve / create pickup place ─────────────────────────────────────────
    let [pickup] = await db
      .select()
      .from(placesTable)
      .where(eq(placesTable.name, pickupName))
      .limit(1);

    if (!pickup) {
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
    } else if (
      pickupLat != null &&
      pickupLng != null &&
      (pickup.lat == null || pickup.lng == null)
    ) {
      await db
        .update(placesTable)
        .set({ lat: String(pickupLat), lng: String(pickupLng) })
        .where(eq(placesTable.id, pickup.id));
    }

    // ── Resolve / create drop place ───────────────────────────────────────────
    let [drop] = await db
      .select()
      .from(placesTable)
      .where(eq(placesTable.name, dropName))
      .limit(1);

    if (!drop) {
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
    } else if (
      dropLat != null &&
      dropLng != null &&
      (drop.lat == null || drop.lng == null)
    ) {
      await db
        .update(placesTable)
        .set({ lat: String(dropLat), lng: String(dropLng) })
        .where(eq(placesTable.id, drop.id));
    }

    const linkedUserId = source === "self" ? user.id : null;
    const initialStatus = source === "admin" ? "confirmed" : "pending";
    const qrExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    // ── ONE-WAY booking ───────────────────────────────────────────────────────
    if (!isRoundTrip) {
      const bookingId = generateBookingId();
      const bookingRef = `BK${Date.now()}`;

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
          serviceType,
          notes,
          status: initialStatus,
          pickupId: pickup.id,
          dropId: drop.id,
          journeyDate,
          journeyTime,
          members,
          vehicleType,
          ac,
          totalFare,
          tripType: "oneway",
          legType: "single",
          qrExpiresAt,
        })
        .returning();

      if (!booking) throw new Error("Unable to create booking");

      if (source === "admin" && parseFloat(totalFare) > 0) {
        await db.insert(paymentsTable).values({
          bookingId: booking.id,
          rzpOrderId: `cash_admin_${nanoid(8)}`,
          amount: totalFare,
          currency: "INR",
          mode: "full",
          status: "cash_collected",
          paymentMethod: "cash",
        });
      }

      logger.info(
        {
          requestId,
          module: "bookings",
          action: "create",
          bookingId: booking.id,
          bookingRef: booking.bookingRef,
        },
        "One-way booking created",
      );
      set.status = 201;
      return {
        success: true,
        message: "Booking created successfully",
        data: booking,
      };
    }

    // ── ROUND TRIP: create both legs in a single transaction ─────────────────
    const outboundId = generateBookingId();
    const returnId = generateBookingId();
    const outboundRef = `BK${Date.now()}`;
    const returnRef = `BK${Date.now() + 1}-R`;

    const { outbound, returnBooking } = await db.transaction(async (tx) => {
      // Step 1: Outbound A → B — carries the full round trip fare
      const [ob] = await tx
        .insert(bookingsTable)
        .values({
          id: outboundId,
          bookingRef: outboundRef,
          userId: linkedUserId,
          bookedByUserId: user.id,
          customerName,
          customerPhone,
          source,
          serviceType,
          notes,
          status: initialStatus,
          pickupId: pickup.id,
          dropId: drop.id,
          journeyDate,
          journeyTime,
          members,
          vehicleType,
          ac,
          totalFare,
          tripType: "roundtrip",
          legType: "outbound",
          qrExpiresAt,
        })
        .returning();

      if (!ob) throw new Error("Unable to create outbound booking");

      // Step 2: Return B → A — fare is 0 (fully covered by outbound payment)
      const [ret] = await tx
        .insert(bookingsTable)
        .values({
          id: returnId,
          bookingRef: returnRef,
          userId: linkedUserId,
          bookedByUserId: user.id,
          customerName,
          customerPhone,
          source,
          serviceType,
          notes,
          status: initialStatus,
          pickupId: drop.id, // swapped
          dropId: pickup.id, // swapped
          journeyDate: returnDate!,
          journeyTime: returnTime!,
          members,
          vehicleType,
          ac,
          totalFare: "0", // payment tracked on outbound; balance collected by return driver via cash flow
          tripType: "roundtrip",
          legType: "return",
          linkedBookingId: outboundId,
          qrExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
        })
        .returning();

      if (!ret) throw new Error("Unable to create return booking");

      // Step 3: Back-fill outbound's linkedBookingId now that return exists
      await tx
        .update(bookingsTable)
        .set({ linkedBookingId: returnId })
        .where(eq(bookingsTable.id, outboundId));

      return { outbound: ob, returnBooking: ret };
    });

    // Admin bookings: single cash payment on outbound covers full round trip
    if (source === "admin" && parseFloat(totalFare) > 0) {
      await db.insert(paymentsTable).values({
        bookingId: outbound.id,
        rzpOrderId: `cash_admin_${nanoid(8)}`,
        amount: totalFare,
        currency: "INR",
        mode: "full",
        status: "cash_collected",
        paymentMethod: "cash",
      });
    }

    logger.info(
      {
        requestId,
        module: "bookings",
        action: "create",
        outboundId: outbound.id,
        returnId: returnBooking.id,
      },
      "Round trip bookings created",
    );

    set.status = 201;
    return {
      success: true,
      message: "Round trip booking created successfully",
      data: outbound, // primary booking for payment flow
      returnBooking, // return leg details
    };
  } catch (error: any) {
    logger.error(
      {
        requestId,
        module: "bookings",
        action: "create",
        error: error.message,
        detail: error.detail,
        code: error.code,
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
