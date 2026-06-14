import { db } from "@/db";
import { avg, count, sql } from "drizzle-orm";

import { reviews as reviewsTable } from "@/db/schema";

export const reviewStatsSchema = {
  detail: {
    tags: ["Reviews"],
    description: "review-stats",
  },
};

export const reviewStats = async () => {
  const [[stats], distRows] = await Promise.all([
    db
      .select({
        average: avg(reviewsTable.rating),
        total: count(reviewsTable.id),
        unreadCount: sql<number>`
          count(*) filter (
            where ${reviewsTable.unread} = true
          )
        `,
        flaggedCount: sql<number>`
          count(*) filter (
            where ${reviewsTable.flagged} = true
          )
        `,
      })
      .from(reviewsTable),
    db
      .select({
        rating: reviewsTable.rating,
        count: count(reviewsTable.id),
      })
      .from(reviewsTable)
      .groupBy(reviewsTable.rating),
  ]);

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    rating: star,
    count: distRows.find((r) => r.rating === star)?.count ?? 0,
  }));

  return {
    average: stats?.average ? parseFloat(String(stats.average)) : 0,
    total: stats?.total ?? 0,
    distribution,
    unreadCount: Number(stats?.unreadCount ?? 0),
    flaggedCount: Number(stats?.flaggedCount ?? 0),
  };
};
