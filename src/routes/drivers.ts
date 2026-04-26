import Elysia, { t } from "elysia";
import { and, count, desc, eq, ilike } from "drizzle-orm";

import { auth } from "../lib/auth";
import { db } from "../db";

import { logger } from "../lib/logging";

import { user as usersTable } from "../db/auth-schema";
import { drivers as driversTable } from "../db/schema";

import { generateDriverId } from "../utils/id";

export const driversRouter = new Elysia({ prefix: "/drivers" })

  /**
   * ------------------------------
   * Global Authentication Guard
   * ------------------------------
   * Purpose:
   * Ensures all driver routes require authenticated session.
   *
   * Injects:
   * - user
   *
   * Response:
   * - 401 Unauthorized if no valid session
   * ------------------------------
   */
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      logger.warn(
        {
          module: "drivers",
          action: "auth",
          status: 401,
        },
        "Unauthorized access attempt on drivers route",
      );

      set.status = 401;
      throw new Error("Unauthorized");
    }

    return { user: session.user };
  })

  /**
   * ------------------------------
   * GET /
   * ------------------------------
   * Purpose:
   * Fetch paginated list of all drivers.
   *
   * Intended Access:
   * Admin / Management dashboard
   *
   * Query Params:
   * - page?: string (default 1)
   * - pageSize?: string (default 10)
   *
   * Response:
   * {
   *   data: Driver[],
   *   pagination: {
   *     page,
   *     pageSize,
   *     totalCount,
   *     totalPages
   *   }
   * }
   * ------------------------------
   */
  .get(
    "/",
    async ({ query }) => {
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
          .orderBy(desc(driversTable.createdAt))
          .limit(pageSize)
          .offset(offset),

        db.select({ value: count() }).from(driversTable),
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
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  )

  /**
   * ------------------------------
   * POST /onboard
   * ------------------------------
   * Purpose:
   * Onboard new driver into system.
   *
   * Workflow:
   * 1. Create auth user account
   * 2. Create driver profile
   * 3. Link both records
   *
   * Default Password:
   * {dob}@mohancabs
   *
   * Example:
   * 2000-05-11@mohancabs
   *
   * Response:
   * {
   *   success: boolean,
   *   message: string,
   *   driverId: string | null
   * }
   * ------------------------------
   */
  .post(
    "/onboard",
    async ({ body, set }) => {
      const requestId = crypto.randomUUID();

      logger.info(
        {
          requestId,
          module: "drivers",
          action: "create",
          payload: {
            name: body.name,
            phone: body.phone,
            vehicleNumber: body.vehicleNumber,
            vehicleType: body.vehicleType,
            ac: body.ac,
          },
        },
        "Driver onboarding started",
      );

      const defaultPassword = `${body.dob}@mohancabs`;

      try {
        return await db.transaction(async (tx) => {
          logger.info(
            {
              requestId,
              module: "drivers",
              step: "create_auth_user",
            },
            "Creating auth profile for driver",
          );

          const newUser = await auth.api.signUpEmail({
            body: {
              name: body.name,
              email: `${body.phone}@mohancabs.in`,
              password: defaultPassword,
              role: "driver",
              phoneNumber: body.phone,
              dob: new Date(body.dob).toISOString(),
            },
          });

          if (!newUser) {
            logger.error(
              {
                requestId,
                module: "drivers",
                step: "create_auth_user",
              },
              "Auth user creation failed",
            );

            throw new Error("Failed to create auth user");
          }

          logger.info(
            {
              requestId,
              module: "drivers",
              userId: newUser.user.id,
            },
            "Auth user created successfully",
          );

          logger.info(
            {
              requestId,
              module: "drivers",
              step: "create_driver_profile",
            },
            "Creating driver profile",
          );

          const [newDriver] = await tx
            .insert(driversTable)
            .values({
              id: generateDriverId(),
              userId: newUser.user.id,
              vehicleNumber: body.vehicleNumber,
              vehicleType: body.vehicleType,
              ac: body.ac,
              isAvailable: true,
            })
            .returning();

          if (!newDriver) {
            logger.error(
              {
                requestId,
                module: "drivers",
                userId: newUser.user.id,
              },
              "Driver profile creation failed",
            );

            throw new Error("Failed to create driver profile");
          }

          logger.info(
            {
              requestId,
              module: "drivers",
              driverId: newDriver.id,
              userId: newUser.user.id,
            },
            "Driver onboarded successfully",
          );

          set.status = 201;

          return {
            success: true,
            message: "Driver created successfully",
            driverId: newDriver.id,
          };
        });
      } catch (error: any) {
        logger.error(
          {
            requestId,
            module: "drivers",
            action: "create",
            error: error.message,
          },
          "Driver onboarding failed",
        );

        set.status = 400;

        return {
          success: false,
          message: error.message.includes("unique")
            ? "Phone number or vehicle number already exists"
            : "Failed to onboard driver",
          driverId: null,
        };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        phone: t.String(),
        dob: t.String(),
        vehicleNumber: t.String(),
        vehicleType: t.Union([
          t.Literal("sedan"),
          t.Literal("suv"),
          t.Literal("minivan"),
        ]),
        ac: t.Boolean(),
        isAvailable: t.Boolean(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
        driverId: t.Nullable(t.String()),
      }),
    },
  )

  /**
   * ------------------------------
   * GET /:id
   * ------------------------------
   * Purpose:
   * Fetch single driver profile by driver id.
   *
   * Includes:
   * - Driver details
   * - Linked user profile
   *
   * Response:
   * 200 Success
   * 404 Driver not found
   * ------------------------------
   */
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      logger.info(
        {
          module: "drivers",
          action: "get_one",
          driverId: id,
        },
        "Fetching driver by id",
      );

      const [driver] = await db
        .select()
        .from(driversTable)
        .innerJoin(usersTable, eq(driversTable.userId, usersTable.id))
        .where(eq(driversTable.id, id))
        .limit(1);

      if (!driver) {
        logger.warn(
          {
            module: "drivers",
            action: "get_one",
            driverId: id,
            status: 404,
          },
          "Driver not found",
        );

        set.status = 404;

        return {
          success: false,
          message: "Driver not found",
        };
      }

      logger.info(
        {
          module: "drivers",
          action: "get_one",
          driverId: id,
        },
        "Driver fetched successfully",
      );

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
  )

  /**
   * --------------------------------------------------------------------------
   * GET /search
   * --------------------------------------------------------------------------
   * Purpose:
   * Search drivers using common operational filters.
   *
   * Searchable Fields:
   * - driver id
   * - driver name
   * - isAvailable
   * - vehicleType
   * - ac
   *
   * Query Params:
   * - id?: string
   * - name?: string
   * - isAvailable?: "true" | "false"
   * - vehicleType?: "sedan" | "suv" | "minivan"
   * - ac?: "true" | "false"
   * - page?: string
   * - pageSize?: string
   *
   * Examples:
   * /drivers/search?name=karthik
   * /drivers/search?id=DRV001
   * /drivers/search?name=raj&isAvailable=true
   * /drivers/search?vehicleType=suv&ac=true
   * --------------------------------------------------------------------------
   */
  .get(
    "/search",
    async ({ query }) => {
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
        filters.push(
          eq(driversTable.isAvailable, query.isAvailable === "true"),
        );
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
    },
    {
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
    },
  );
