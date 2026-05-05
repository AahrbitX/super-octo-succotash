import { t } from "elysia";
import { db } from "@/db";
import { and, count, desc, eq, ilike } from "drizzle-orm";

import { logger } from "@/lib/logging";
import { drivers as driversTable } from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

export const searchDriversSchema = {
  query: t.Object({
    id: t.Optional(t.String()),
    name: t.Optional(t.String()),
    isAvailable: t.Optional(t.String()),
    vehicleType: t.Optional(
      t.Union([t.Literal("sedan"), t.Literal("suv"), t.Literal("minivan")]),
    ),
    ac: t.Optional(t.String()),
    page: t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
  }),
  detail: {
    tags: ["Drivers"],
    description: "",
  },
};

export const searchDrivers = async ({
  query,
}: {
  query: (typeof searchDriversSchema)["query"]["static"];
}) => {
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  const filters = [];

  if (query.id) {
    filters.push(eq(driversTable.id, query.id));
  }

  if (query.name) {
    filters.push(ilike(usersTable.name, `%${query.name.trim()}%`));
  }

  if (query.isAvailable !== undefined) {
    filters.push(eq(driversTable.isAvailable, query.isAvailable === "true"));
  }

  if (query.vehicleType) {
    filters.push(eq(driversTable.vehicleType, query.vehicleType));
  }

  if (query.ac !== undefined) {
    filters.push(eq(driversTable.ac, query.ac === "true"));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  logger.info(
    {
      module: "drivers",
      action: "search",
      filters: query,
      page,
      pageSize,
    },
    "Driver search started",
  );

  const [data, [totalQueryResult]] = await Promise.all([
    db
      .select({
        id: driversTable.id,
        userId: driversTable.userId,
        name: usersTable.name,
        phoneNumber: usersTable.phoneNumber,
        vehicleNumber: driversTable.vehicleNumber,
        vehicleType: driversTable.vehicleType,
        ac: driversTable.ac,
        isAvailable: driversTable.isAvailable,
        createdAt: driversTable.createdAt,
      })
      .from(driversTable)
      .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(driversTable.createdAt))
      .limit(pageSize)
      .offset(offset),

    db
      .select({ value: count() })
      .from(driversTable)
      .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(whereClause),
  ]);

  const totalCount = totalQueryResult?.value ?? 0;

  logger.info(
    {
      module: "drivers",
      action: "search",
      resultCount: data.length,
      totalCount,
    },
    "Driver search completed",
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
