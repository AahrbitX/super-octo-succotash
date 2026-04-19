import Elysia, { t } from "elysia";
import { eq, count, desc } from "drizzle-orm";

import { db } from "../db";
import { auth } from "../lib/auth";
import { bookings as bookingsTable } from "../db/schema";

export const bookingsRouter = new Elysia({ prefix: "/bookings" })

  // Make sure user is authenticated for all booking routes
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })

  // 1. GET /bookings - Paginated list of user's bookings
  // Purpose: Allow users to view their booking history with pagination support. Admins can view all bookings via a separate endpoint.
  // Returns: { data: Booking[], pagination: { page, pageSize, totalCount, totalPages } }
  // Query Params: page (default 1), pageSize (default 10)
  .get(
    "/",
    async ({ user, query }) => {
      // 1. Parse pagination params with defaults
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 10;
      const offset = (page - 1) * pageSize;

      // 2. Run queries in parallel for performance
      const [data, [totalQueryResult]] = await Promise.all([
        db
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.userId, user.id))
          .limit(pageSize)
          .offset(offset)
          // descending order to show most recent bookings first
          .orderBy(desc(bookingsTable.createdAt)),

        db
          .select({ value: count() })
          .from(bookingsTable)
          .where(eq(bookingsTable.userId, user.id)),
      ]);

      const totalCount = totalQueryResult?.value || 0;

      return {
        data,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      };
    },
    {
      // Elysia Query Validation
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  )

  // 2. GET /bookings/all - Paginated list of all bookings (Admin Only)
  // Purpose: Allow admins to view all bookings across the platform with pagination support.
  // Returns: { data: Booking[], pagination: { page, pageSize, totalCount, totalPages } }
  // Query Params: page (default 1), pageSize (default 10)
  .get(
    "/all",
    async ({ user, set, query }) => {
      if (user.role !== "admin") {
        set.status = 403;
        throw new Error("Forbidden: Admins only");
      }

      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 10;
      const offset = (page - 1) * pageSize;

      const [data, [totalQueryResult]] = await Promise.all([
        db
          .select()
          .from(bookingsTable)
          .limit(pageSize)
          .offset(offset)
          .orderBy(desc(bookingsTable.createdAt)),
        db.select({ value: count() }).from(bookingsTable),
      ]);

      const totalCount = totalQueryResult?.value || 0;

      return {
        data,
        pagination: {
          page,
          pageSize,
          totalCount: totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  )

  // 3. GET Single booking by ID (Hybrid Authorization)
  // Purpose: Allow users to view details of a specific booking. Users can only access their own bookings, while admins can access any booking.
  // Returns: Booking object if found and authorized, otherwise 404 or 403 error.
  // Path Params: id (booking ID)
  .get("/:id", async ({ user, set, params: { id } }) => {
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id));

    if (!booking) {
      set.status = 404;
      return { message: "Booking not found" };
    }

    const isOwner = booking.userId === user.id;
    const isAdmin = user.role === "admin";

    if (!isAdmin && !isOwner) {
      set.status = 403;
      throw new Error("Forbidden: You do not have access to this booking");
    }

    return booking;
  });
