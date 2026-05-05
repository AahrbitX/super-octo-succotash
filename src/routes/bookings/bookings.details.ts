import { db } from "@/db";
import { logger } from "@/lib/logging";
import { alias } from "drizzle-orm/pg-core";

import { eq } from "drizzle-orm";
import {
  places as placesTable,
  bookings as bookingsTable,
  drivers as driversTable,
} from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

export const bookingDetailsSchema = {
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
  params: { id: string };
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

      dropId: dropPlaceTable.id,
      dropName: dropPlaceTable.name,
      dropZone: dropPlaceTable.zone,

      totalFare: bookingsTable.totalFare,
      status: bookingsTable.status,

      createdAt: bookingsTable.createdAt,
      updatedAt: bookingsTable.updatedAt,

      riderUserName: usersTable.name,
      riderPhone: usersTable.phoneNumber,
      riderJoinedAt: usersTable.createdAt,

      driverId: driversTable.id,
      driverName: driverUserTable.name,
      driverPhone: driverUserTable.phoneNumber,
      vehicleNumber: driversTable.vehicleNumber,
      driverVehicleType: driversTable.vehicleType,
      driverAc: driversTable.ac,
    })
    .from(bookingsTable)
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .leftJoin(driversTable, eq(bookingsTable.driverId, driversTable.id))
    .leftJoin(driverUserTable, eq(driversTable.userId, driverUserTable.id))
    .leftJoin(pickupPlaceTable, eq(bookingsTable.pickupId, pickupPlaceTable.id))
    .leftJoin(dropPlaceTable, eq(bookingsTable.dropId, dropPlaceTable.id))
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
          bookedFor: "",
          bookedBy: "Staff Booking",
          memberSince: null,
        }
      : {
          name: booking.riderUserName,
          phone: booking.riderPhone,
          bookedAt: booking.createdAt,
          bookedFor: "",
          bookedBy: "Self Booking",
          memberSince: booking.riderJoinedAt,
        };

  const driver = {
    id: booking.driverId,
    name: booking.driverName,
    phone: booking.driverPhone,
    ac: booking.driverAc,
    vehicleType: booking.driverVehicleType,
    vehicleNumber: booking.vehicleNumber,
  };

  const info = {
    requestedAt: booking.createdAt,
    vehicleType: booking.vehicleType,
    ac: booking.ac,
    journeyData: booking.journeyDate,
    journeyTime: booking.journeyTime,
    members: booking.members,
  };

  const route = {
    pickUp: booking.pickupName,
    pickupZone: booking.pickupZone,
    drop: booking.dropName,
    dropZone: booking.dropZone,
  };

  logger.info(
    {
      module: "bookings",
      action: "get_one",
      bookingId: params.id,
      source: booking.source,
    },
    "Booking details fetched successfully",
  );

  return {
    success: true,

    data: {
      id: booking.id,
      bookingRef: booking.bookingRef,
      source: booking.source,

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

      payment: {
        fare: booking.totalFare,
      },

      status: booking.status,

      timestamps: {
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    },
  };
};

export { bookingDetails };
