import { db } from "@/db";
import { logger } from "@/lib/logging";
import { alias } from "drizzle-orm/pg-core";

import { t } from "elysia";
import { eq, avg, sql, desc } from "drizzle-orm";
import {
  places as placesTable,
  bookings as bookingsTable,
  drivers as driversTable,
  payments as paymentsTable,
  reviews as reviewsTable,
} from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

export const bookingDetailsSchema = {
  params: t.Object({
    id: t.String(),
  }),
  detail: {
    tags: ["Bookings"],
    description: "",
  },
};

const bookingDetails = async ({
  user,
  set,
  params,
}: {
  user: any;
  set: any;
  params: (typeof bookingDetailsSchema)["params"]["static"];
}) => {
  logger.info(
    {
      module: "bookings",
      action: "get_one",
      bookingId: params.id,
      userId: user.id,
    },
    "Fetching booking details",
  );

  const driverUserTable = alias(usersTable, "driver_user");
  const pickupPlaceTable = alias(placesTable, "pickup_place");
  const dropPlaceTable = alias(placesTable, "drop_place");

  const [booking] = await db
    .select({
      id: bookingsTable.id,
      bookingRef: bookingsTable.bookingRef,
      source: bookingsTable.source,

      userId: bookingsTable.userId,
      bookedByUserId: bookingsTable.bookedByUserId,

      customerName: bookingsTable.customerName,
      customerPhone: bookingsTable.customerPhone,

      journeyDate: bookingsTable.journeyDate,
      journeyTime: bookingsTable.journeyTime,

      members: bookingsTable.members,
      vehicleType: bookingsTable.vehicleType,
      ac: bookingsTable.ac,

      pickupId: pickupPlaceTable.id,
      pickupName: pickupPlaceTable.name,
      pickupZone: pickupPlaceTable.zone,
      pickupLat: pickupPlaceTable.lat,
      pickupLng: pickupPlaceTable.lng,

      dropId: dropPlaceTable.id,
      dropName: dropPlaceTable.name,
      dropZone: dropPlaceTable.zone,
      dropLat: dropPlaceTable.lat,
      dropLng: dropPlaceTable.lng,

      totalFare: bookingsTable.totalFare,
      status: bookingsTable.status,

      createdAt: bookingsTable.createdAt,
      confirmedAt: bookingsTable.confirmedAt,
      rideStartedAt: bookingsTable.rideStartedAt,
      rideEndedAt: bookingsTable.rideEndedAt,
      updatedAt: bookingsTable.updatedAt,

      riderUserName: usersTable.name,
      riderPhone: usersTable.phoneNumber,
      riderJoinedAt: usersTable.createdAt,

      qrToken: bookingsTable.qrToken,
      rideStartOtp: bookingsTable.rideStartOtp,

      tripType: bookingsTable.tripType,
      legType: bookingsTable.legType,
      linkedBookingId: bookingsTable.linkedBookingId,

      driverId: driversTable.id,
      driverName: driverUserTable.name,
      driverPhone: driverUserTable.phoneNumber,
      vehicleNumber: driversTable.vehicleNumber,
      driverVehicleType: driversTable.vehicleType,
      driverAc: driversTable.ac,

      reviewId: reviewsTable.id,
      reviewRating: reviewsTable.rating,
      reviewComment: reviewsTable.comment,
      reviewSubmittedAt: reviewsTable.submittedAt,
    })
    .from(bookingsTable)
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
    .leftJoin(driverUserTable, eq(driversTable.userId, driverUserTable.id))
    .leftJoin(pickupPlaceTable, eq(bookingsTable.pickupId, pickupPlaceTable.id))
    .leftJoin(dropPlaceTable, eq(bookingsTable.dropId, dropPlaceTable.id))
    .leftJoin(reviewsTable, eq(reviewsTable.bookingId, bookingsTable.id))
    .where(eq(bookingsTable.id, params.id))
    .limit(1);

  if (!booking) {
    logger.warn(
      {
        module: "bookings",
        action: "get_one",
        bookingId: params.id,
        status: 404,
      },
      "Booking not found",
    );

    set.status = 404;

    return {
      success: false,
      message: "Booking not found",
    };
  }

  const isOwner = booking.userId === user.id;
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    logger.warn(
      {
        module: "bookings",
        action: "get_one",
        bookingId: params.id,
        userId: user.id,
        status: 403,
      },
      "Forbidden booking access",
    );

    set.status = 403;
    throw new Error("Forbidden");
  }

  const rider =
    booking.source === "admin" || !booking.userId
      ? {
          name: booking.customerName,
          phone: booking.customerPhone,
          bookedAt: booking.createdAt,
          bookedFor: booking.journeyDate,
          bookedBy: "Staff Booking",
          memberSince: null,
        }
      : {
          name: booking.riderUserName,
          phone: booking.riderPhone,
          bookedAt: booking.createdAt,
          bookedFor: booking.journeyDate,
          bookedBy: "Self Booking",
          memberSince: booking.riderJoinedAt,
        };

  // Fetch driver stats if a driver is assigned
  let driverTotalTrips: number | null = null;
  let driverRating: string | null = null;

  if (booking.driverId) {
    const [driverStats] = await db
      .select({
        totalTrips: sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.status} = 'completed')::int`,
        avgRating: avg(reviewsTable.rating),
      })
      .from(bookingsTable)
      .leftJoin(reviewsTable, eq(reviewsTable.bookingId, bookingsTable.id))
      .where(eq(bookingsTable.driverId, booking.driverId));

    driverTotalTrips = driverStats?.totalTrips ?? 0;
    driverRating = driverStats?.avgRating
      ? parseFloat(driverStats.avgRating).toFixed(1)
      : null;
  }

  const driver = {
    id: booking.driverId,
    name: booking.driverName,
    phone: booking.driverPhone,
    ac: booking.driverAc,
    vehicleType: booking.driverVehicleType,
    vehicleNumber: booking.vehicleNumber,
    totalTrips: driverTotalTrips,
    rating: driverRating,
  };

  const info = {
    requestedAt: booking.createdAt,
    vehicleType: booking.vehicleType,
    ac: booking.ac,
    journeyDate: booking.journeyDate,
    journeyTime: booking.journeyTime,
    members: booking.members,
  };

  const route = {
    pickupName: booking.pickupName,
    pickupZone: booking.pickupZone,
    pickupLat: booking.pickupLat ? parseFloat(booking.pickupLat) : null,
    pickupLng: booking.pickupLng ? parseFloat(booking.pickupLng) : null,
    dropName: booking.dropName,
    dropZone: booking.dropZone,
    dropLat: booking.dropLat ? parseFloat(booking.dropLat) : null,
    dropLng: booking.dropLng ? parseFloat(booking.dropLng) : null,
  };

  // Fetch linked leg summary (round trips only)
  let linkedLeg: {
    id: string;
    bookingRef: string;
    status: string;
    legType: string;
    journeyDate: string;
    journeyTime: string;
    driverName: string | null;
  } | null = null;

  if (booking.linkedBookingId) {
    const linkedDriverUser = alias(usersTable, "linked_driver_user");
    const [lb] = await db
      .select({
        id: bookingsTable.id,
        bookingRef: bookingsTable.bookingRef,
        status: bookingsTable.status,
        legType: bookingsTable.legType,
        journeyDate: bookingsTable.journeyDate,
        journeyTime: bookingsTable.journeyTime,
        driverName: linkedDriverUser.name,
      })
      .from(bookingsTable)
      .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
      .leftJoin(linkedDriverUser, eq(driversTable.userId, linkedDriverUser.id))
      .where(eq(bookingsTable.id, booking.linkedBookingId))
      .limit(1);
    linkedLeg = lb ?? null;
  }

  // Fetch all payment records for this booking (separate query — avoids
  // leftJoin duplicating the booking row when multiple payments exist)
  const paymentRows = await db
    .select({
      id: paymentsTable.id,
      amount: paymentsTable.amount,
      status: paymentsTable.status,
      paymentMethod: paymentsTable.paymentMethod,
      mode: paymentsTable.mode,
      paidAt: paymentsTable.paidAt,
      cashVerifiedAt: paymentsTable.cashVerifiedAt,
      adminVerifiedBy: paymentsTable.adminVerifiedBy,
      adminVerifiedAt: paymentsTable.adminVerifiedAt,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .where(eq(paymentsTable.bookingId, params.id))
    .orderBy(desc(paymentsTable.createdAt));

  logger.info(
    {
      module: "bookings",
      action: "get_one",
      bookingId: params.id,
      source: booking.source,
    },
    "Booking details fetched successfully",
  );

  // Latest successful payment for summary fields (fare display, method, etc.)
  const latestPayment = paymentRows[0] ?? null;

  return {
    success: true,

    data: {
      id: booking.id,
      bookingRef: booking.bookingRef,
      source: booking.source,
      qrToken: booking.qrToken,
      // Ride-start OTP: only expose to the booking owner (customer) when status is confirmed
      rideStartOtp: (isOwner && booking.status === "confirmed") ? (booking.rideStartOtp ?? null) : null,
      tripType: booking.tripType,
      legType: booking.legType,
      linkedBookingId: booking.linkedBookingId,
      linkedLeg,

      rider,
      driver,
      route,
      info,

      trip: {
        journeyDate: booking.journeyDate,
        journeyTime: booking.journeyTime,
        members: booking.members,
        vehicleType: booking.vehicleType,
        ac: booking.ac,
      },

      // Single-payment summary for backward-compat (used by admin detail page)
      payment: {
        fare: booking.totalFare,
        amount: latestPayment?.amount ?? null,
        status: latestPayment?.status ?? null,
        method: latestPayment?.paymentMethod ?? null,
        mode: latestPayment?.mode ?? null,
        paidAt: latestPayment?.paidAt ?? null,
        cashVerifiedAt: latestPayment?.cashVerifiedAt ?? null,
        adminVerifiedBy: latestPayment?.adminVerifiedBy ?? null,
        adminVerifiedAt: latestPayment?.adminVerifiedAt ?? null,
        id: latestPayment?.id ?? null,
      },

      // Full transaction history — all payment attempts for this booking
      transactions: paymentRows.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        method: p.paymentMethod,
        mode: p.mode,
        paidAt: p.paidAt,
        cashVerifiedAt: p.cashVerifiedAt,
        createdAt: p.createdAt,
      })),

      status: booking.status,

      // Timestamps for each status milestone
      timeline: {
        pending: booking.createdAt,
        confirmed: booking.confirmedAt ?? null,
        ongoing: booking.rideStartedAt ?? null,
        completed: booking.rideEndedAt ?? null,
      },

      review: booking.reviewRating
        ? {
            id: booking.reviewId,
            rating: booking.reviewRating,
            comment: booking.reviewComment ?? null,
            submittedAt: booking.reviewSubmittedAt,
          }
        : null,

      timestamps: {
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    },
  };
};

export { bookingDetails };
