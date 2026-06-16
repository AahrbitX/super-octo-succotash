import { t } from "elysia";

import { db } from "@/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { user as usersTable } from "@/db/auth-schema";

export const usersListSchema = {
  query: t.Object({
    page:     t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
    search:   t.Optional(t.String()), // ILIKE on name or phoneNumber
  }),
  detail: {
    tags: ["Users"],
    description: "",
  },
};

export const usersList = async ({
  query,
}: {
  query: (typeof usersListSchema)["query"]["static"];
}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 15, 1), 100);
  const offset = (page - 1) * pageSize;

  const searchCondition = query.search
    ? or(
        ilike(usersTable.name, `%${query.search}%`),
        ilike(usersTable.phoneNumber, `%${query.search}%`),
      )
    : undefined;

  const whereCondition = and(eq(usersTable.role, "user"), eq(usersTable.isDeleted, false), searchCondition);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(usersTable)
      .where(whereCondition)
      .orderBy(desc(usersTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(whereCondition),
  ]);

  const totalCount = Number(countResult[0]?.count);
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
};
