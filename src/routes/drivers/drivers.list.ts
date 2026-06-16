import { t } from "elysia";

import { db } from "@/db";
import { logger } from "@/lib/logging";

import { drivers as driversTable } from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";

export const driversListSchema = {
  query: t.Object({
    page:        t.Optional(t.String()),
    pageSize:    t.Optional(t.String()),
    search:      t.Optional(t.String()),      // ILIKE on name or vehicleNumber
    isAvailable: t.Optional(t.String()),      // "true" | "false"
  }),
  detail: {
    tags: ["Drivers"],
    description: "",
  },
};

export const driversList = async ({
  query,
}: {
  query: (typeof driversListSchema)["query"]["static"];
}) => {
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  logger.info(
    {
      module: "drivers",
      action: "list",
      page,
      pageSize,
      offset,
    },
    "Fetching paginated drivers list",
  );

  const searchCondition = query.search
    ? or(
        ilike(usersTable.name, `%${query.search}%`),
        ilike(driversTable.vehicleNumber, `%${query.search}%`),
      )
    : undefined;

  const availabilityCondition =
    query.isAvailable === "true"  ? eq(driversTable.isAvailable, true)  :
    query.isAvailable === "false" ? eq(driversTable.isAvailable, false) :
    undefined;

  const whereCondition = and(eq(driversTable.isDeleted, false), searchCondition, availabilityCondition);

  const [data, [totalQueryResult]] = await Promise.all([
    db
      .select({
        id: driversTable.id,
        userId: driversTable.userId,
        name: usersTable.name,
        phoneNumber: usersTable.phoneNumber,
        dob: usersTable.dob,
        vehicleNumber: driversTable.vehicleNumber,
        vehicleType: driversTable.vehicleType,
        ac: driversTable.ac,
        isAvailable: driversTable.isAvailable,
        createdAt: driversTable.createdAt,
      })
      .from(driversTable)
      .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(whereCondition)
      .orderBy(desc(driversTable.createdAt))
      .limit(pageSize)
      .offset(offset),

    db.select({ value: count() })
      .from(driversTable)
      .leftJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(whereCondition),
  ]);

  const totalCount = totalQueryResult?.value ?? 0;

  logger.info(
    {
      module: "drivers",
      action: "list",
      resultCount: data.length,
      totalCount,
    },
    "Drivers list fetched successfully",
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
