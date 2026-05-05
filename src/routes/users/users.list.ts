import { t } from "elysia";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { user as usersTable } from "@/db/auth-schema";

export const usersListSchema = {
  query: t.Object({
    page: t.Optional(t.String()),
  }),
  detail: {
    tags: ["Users"],
    description: "",
  },
};

export const usersList = async ({
  query,
}: {
  query: (typeof usersListSchema)["query"]["schema"];
}) => {
  // Get all the users with pagination
  // if page is not provided, default to 1

  const page = Number(query.page) || 1;
  const pageSize = 15;
  const offset = (page - 1) * pageSize;

  // Run both queries in parallel for better performance
  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "user"))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
  ]);

  const totalCount = Number(countResult[0]?.count);
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data,
    pagination: {
      current: page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
};
