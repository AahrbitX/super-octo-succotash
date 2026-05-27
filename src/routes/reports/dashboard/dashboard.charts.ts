import { t } from "elysia";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { bookings as bookingsTable } from "@/db/schema";

export const dashboardChartsSchema = {
  query: t.Object({}),
};

export const dashboardCharts = async () => {
  const dailyRides = await db
    .select({
      date: sql<string>`DATE(${bookingsTable.createdAt})`,
      count: sql<number>`COUNT(${bookingsTable.id})`,
    })
    .from(bookingsTable)
    .where(
      sql`
        ${bookingsTable.status} = 'completed'
        AND ${bookingsTable.createdAt} >= NOW() - INTERVAL '7 days'
      `,
    )
    .groupBy(sql`DATE(${bookingsTable.createdAt})`)
    .orderBy(sql`DATE(${bookingsTable.createdAt}) ASC`);

  const vehicleStats = await db
    .select({
      vehicleType: bookingsTable.vehicleType,
      count: sql<number>`COUNT(${bookingsTable.id})`,
    })
    .from(bookingsTable)
    .groupBy(bookingsTable.vehicleType)
    .orderBy(bookingsTable.vehicleType);

  return {
    dailyRides,
    vehicleStats,
  };
};
