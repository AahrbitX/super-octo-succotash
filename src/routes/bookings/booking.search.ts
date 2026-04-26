import { db } from "@/db";
import { logger } from "@/lib/logging";

import { t } from "elysia";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { bookings as bookingsTable } from "@/db/schema";

export const searchBookingSchema = {
  query: t.Object({
    bookingRef: t.Optional(t.String()),
    status: t.Optional(
      t.Union([
        t.Literal("pending"),
        t.Literal("confirmed"),
        t.Literal("completed"),
        t.Literal("cancelled"),
      ]),
    ),
    vehicleType: t.Optional(
      t.Union([t.Literal("sedan"), t.Literal("suv"), t.Literal("minivan")]),
    ),
    journeyDate: t.Optional(t.String()),
    ac: t.Optional(t.String()),
    page: t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
  }),
};

const searchBooking = async ({
  user,
  query,
}: {
  user: any;
  set: any;
  query: (typeof searchBookingSchema)["query"]["static"];
}) => {
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  const filters = [];

  if (query.bookingRef) {
    filters.push(
      ilike(bookingsTable.bookingRef, `%${query.bookingRef.trim()}%`),
    );
  }

  if (query.status) {
    filters.push(eq(bookingsTable.status, query.status));
  }

  if (query.vehicleType) {
    filters.push(eq(bookingsTable.vehicleType, query.vehicleType));
  }

  if (query.journeyDate) {
    filters.push(eq(bookingsTable.journeyDate, query.journeyDate));
  }

  if (query.ac !== undefined) {
    filters.push(eq(bookingsTable.ac, query.ac === "true"));
  }

  if (user.role !== "admin") {
    filters.push(eq(bookingsTable.userId, user.id));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  logger.info(
    {
      module: "bookings",
      action: "search",
      userId: user.id,
      role: user.role,
      filters: query,
      page,
      pageSize,
    },
    "Booking search started",
  );

  const [data, [total]] = await Promise.all([
    db
      .select()
      .from(bookingsTable)
      .where(whereClause)
      .orderBy(desc(bookingsTable.createdAt))
      .limit(pageSize)
      .offset(offset),

    db.select({ value: count() }).from(bookingsTable).where(whereClause),
  ]);

  const totalCount = total?.value ?? 0;

  logger.info(
    {
      module: "bookings",
      action: "search",
      resultCount: data.length,
      totalCount,
    },
    "Booking search completed",
  );

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
};

export { searchBooking };
