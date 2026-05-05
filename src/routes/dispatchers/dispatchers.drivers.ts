import { t } from "elysia";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { user as usersTable } from "@/db/auth-schema";

import {
  bookings as bookingsTable,
  drivers as driversTable,
} from "@/db/schema";

export const dispatcherSuggestedDriversSchema = {
  params: t.Object({
    bookingId: t.String(),
  }),

  query: t.Object({
    search: t.Optional(t.String()),
    vehicleType: t.Optional(t.String()),
    ac: t.Optional(t.String()),
    seats: t.Optional(t.String()),
  }),

  detail: {
    tags: ["Dispatchers"],
    description: "",
  },
};

export const dispatcherSuggestedDrivers = async ({
  params,
  query,
  set,
}: {
  params: { bookingId: string };
  query: {
    search?: string;
    vehicleType?: string;
    ac?: string;
    seats?: string;
  };
  set: any;
}) => {
  const [booking] = await db
    .select({
      vehicleType: bookingsTable.vehicleType,
      ac: bookingsTable.ac,
      seats: bookingsTable.members,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.bookingId))
    .limit(1);

  if (!booking) {
    set.status = 404;
    return {
      message: "Booking not found",
    };
  }

  const selectedVehicleType = query.vehicleType ?? booking.vehicleType;

  const selectedAc = query.ac !== undefined ? query.ac === "true" : booking.ac;

  const selectedSeats =
    query.seats !== undefined ? Number(query.seats) : booking.seats;

  const conditions = [
    eq(driversTable.isAvailable, true),
    eq(driversTable.vehicleType, selectedVehicleType as any),
    eq(driversTable.ac, selectedAc),
  ];

  if (query.search?.trim()) {
    conditions.push(
      sql`(
        ${usersTable.name} ILIKE ${`%${query.search}%`}
        OR ${driversTable.id} ILIKE ${`%${query.search}%`}
        OR ${driversTable.vehicleNumber} ILIKE ${`%${query.search}%`}
      )`,
    );
  }

  const data = await db
    .select({
      id: driversTable.id,
      name: usersTable.name,
      phone: usersTable.phoneNumber,
      vehicleType: driversTable.vehicleType,
      ac: driversTable.ac,
      vehicleNumber: driversTable.vehicleNumber,
      isAvailable: driversTable.isAvailable,
    })
    .from(driversTable)
    .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
    .where(and(...conditions))
    .orderBy(asc(usersTable.name));

  return {
    filters: {
      vehicleType: selectedVehicleType,
      ac: selectedAc,
      seats: selectedSeats,
    },

    data,
  };
};
