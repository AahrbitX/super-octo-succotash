import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { bookings as bookingsTable, payments as paymentsTable, reviews as reviewsTable } from "@/db/schema";

export const userStatsSchema = {
  detail: {
    tags: ["Users"],
    description: "Get stats for the logged-in user (rides, spend, rating)",
  },
};

export const userStats = async ({ user }: { user: any }) => {
  const userId = user.id;

  const now = new Date();
  const monthLabel = now.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const [totalRidesResult, thisMonthResult, totalSpentResult, ratingResult] =
    await Promise.all([
      // All-time completed rides
      db
        .select({ count: sql<number>`COUNT(${bookingsTable.id})` })
        .from(bookingsTable)
        .where(
          sql`${bookingsTable.userId} = ${userId} AND ${bookingsTable.status} = 'completed'`,
        ),

      // Completed rides this calendar month
      db
        .select({ count: sql<number>`COUNT(${bookingsTable.id})` })
        .from(bookingsTable)
        .where(
          sql`
            ${bookingsTable.userId} = ${userId}
            AND ${bookingsTable.status} = 'completed'
            AND DATE_TRUNC('month', ${bookingsTable.createdAt}) = DATE_TRUNC('month', NOW())
          `,
        ),

      // Total amount paid across all bookings
      db
        .select({
          total: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)`,
        })
        .from(paymentsTable)
        .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
        .where(
          sql`${bookingsTable.userId} = ${userId} AND ${paymentsTable.status} = 'paid'`,
        ),

      // Average rating + count from reviews on user's bookings
      db
        .select({
          avg: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
          count: sql<number>`COUNT(${reviewsTable.id})`,
        })
        .from(reviewsTable)
        .innerJoin(bookingsTable, eq(reviewsTable.bookingId, bookingsTable.id))
        .where(sql`${bookingsTable.userId} = ${userId}`),
    ]);

  return {
    totalRides: Number(totalRidesResult[0]?.count ?? 0),
    thisMonth: Number(thisMonthResult[0]?.count ?? 0),
    totalSpent: Number(totalSpentResult[0]?.total ?? 0),
    rating: parseFloat(Number(ratingResult[0]?.avg ?? 0).toFixed(1)),
    ratingCount: Number(ratingResult[0]?.count ?? 0),
    monthLabel,
  };
};
