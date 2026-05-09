import { t } from "elysia";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logging";

import { db } from "@/db";
import { drivers as driversTable } from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

export const updateDriverSchema = {
  params: t.Object({
    id: t.String(),
  }),

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

  response: {
    200: t.Object({
      success: t.Boolean(),
      message: t.String(),
    }),

    404: t.Object({
      success: t.Boolean(),
      message: t.String(),
    }),
  },

  detail: {
    tags: ["Drivers"],
    description: "Update driver details",
  },
};

export const updateDriver = async ({
  params,
  body,
  set,
}: {
  params: (typeof updateDriverSchema)["params"]["static"];
  body: (typeof updateDriverSchema)["body"]["static"];
  set: any;
}) => {
  const requestId = crypto.randomUUID();

  logger.info(
    {
      requestId,
      module: "drivers",
      action: "update",
      driverId: params.id,
    },
    "Driver update started",
  );

  console.log(params, body);

  try {
    return await db.transaction(async (tx) => {
      const [existingDriver] = await tx
        .select()
        .from(driversTable)
        .where(eq(driversTable.id, params.id))
        .limit(1);

      if (!existingDriver) {
        set.status = 404;

        return {
          success: false,
          message: "Driver not found",
        };
      }

      logger.info(
        {
          requestId,
          module: "drivers",
          driverId: params.id,
          userId: existingDriver.userId,
        },
        "Updating auth user",
      );

      await tx
        .update(usersTable)
        .set({
          name: body.name,
          phoneNumber: body.phone,
          dob: new Date(body.dob).toISOString(),
          email: `${body.phone}@mohancabs.in`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existingDriver.userId));

      logger.info(
        {
          requestId,
          module: "drivers",
          driverId: params.id,
        },
        "Updating driver profile",
      );

      await tx
        .update(driversTable)
        .set({
          vehicleNumber: body.vehicleNumber,
          vehicleType: body.vehicleType,
          ac: body.ac,
          isAvailable: body.isAvailable,
          updatedAt: new Date(),
        })
        .where(eq(driversTable.id, params.id));

      logger.info(
        {
          requestId,
          module: "drivers",
          driverId: params.id,
        },
        "Driver updated successfully",
      );

      return {
        success: true,
        message: "Driver updated successfully",
      };
    });
  } catch (error: any) {
    logger.error(
      {
        requestId,
        module: "drivers",
        action: "update",
        driverId: params.id,
        error: error.message,
      },
      "Driver update failed",
    );

    set.status = 400;

    return {
      success: false,
      message: error.message.includes("unique")
        ? "Phone number or vehicle number already exists"
        : "Failed to update driver",
    };
  }
};
