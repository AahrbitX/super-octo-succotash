import { db } from "../db";
import { auth } from "../lib/auth";
import { user as usersTable } from "../db/auth-schema";

import { eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

export const usersRouter = new Elysia({ prefix: "/users" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .get(
    "/",
    async ({ query }) => {
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
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const [driver] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);

      if (!driver) {
        set.status = 404;
        return { success: false, message: "Driver not found" };
      }

      return {
        success: true,
        data: driver,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        404: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    },
  );
