import { t } from "elysia";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

export const dashboardChartsSchema = {
  query: t.Object({}),
};

export const dashboardCharts = async () => {
  // ── 1. Daily rides — last 7 days (total bookings + completed) ─────────────
  const dailyRaw = await db
    .select({
      date:      sql<string>`DATE(${bookingsTable.createdAt})::text`,
      bookings:  sql<number>`COUNT(*)::int`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.status} = 'completed')::int`,
    })
    .from(bookingsTable)
    .where(sql`${bookingsTable.createdAt} >= NOW() - INTERVAL '7 days'`)
    .groupBy(sql`DATE(${bookingsTable.createdAt})`)
    .orderBy(sql`DATE(${bookingsTable.createdAt}) ASC`);

  // Build a full 7-day series so missing days appear as 0
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  });

  const dailyMap = Object.fromEntries(dailyRaw.map((r) => [r.date, r]));

  const dailyRides = last7.map((date) => ({
    date,
    day: new Date(date + "T12:00:00Z").toLocaleDateString("en-IN", {
      weekday: "short",
    }),
    bookings:  Number(dailyMap[date]?.bookings  ?? 0),
    completed: Number(dailyMap[date]?.completed ?? 0),
  }));

  // ── 2. Vehicle stats — all-time (total bookings + completed per type) ─────
  const vehicleRaw = await db
    .select({
      vehicleType: bookingsTable.vehicleType,
      bookings:    sql<number>`COUNT(*)::int`,
      completed:   sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.status} = 'completed')::int`,
    })
    .from(bookingsTable)
    .groupBy(bookingsTable.vehicleType)
    .orderBy(bookingsTable.vehicleType);

  const vehicleStats = vehicleRaw.map((v) => ({
    vehicle:   v.vehicleType ?? "unknown",
    bookings:  Number(v.bookings),
    completed: Number(v.completed),
  }));

  // ── 3. Summary counters ───────────────────────────────────────────────────
  const [totals] = await db
    .select({
      totalBookings: sql<number>`COUNT(*)::int`,
      completed:     sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.status} = 'completed')::int`,
      pending:       sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.status} IN ('pending', 'confirmed'))::int`,
      todayBookings: sql<number>`COUNT(*) FILTER (WHERE DATE(${bookingsTable.createdAt}) = CURRENT_DATE)::int`,
    })
    .from(bookingsTable);

  const [rev] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${paymentsTable.amount}), 0)::text`,
    })
    .from(paymentsTable)
    .where(sql`${paymentsTable.status} IN ('paid', 'cash_collected')`);

  return {
    dailyRides,
    vehicleStats,
    summary: {
      totalBookings: Number(totals?.totalBookings ?? 0),
      completed:     Number(totals?.completed     ?? 0),
      pending:       Number(totals?.pending       ?? 0),
      todayBookings: Number(totals?.todayBookings ?? 0),
      totalRevenue:  rev?.total ?? "0",
    },
  };
};
