import { db } from "@/db";
import { logger } from "@/lib/logging";

import { t } from "elysia";
import { auth } from "@/lib/auth";
import { generateDriverId } from "@/utils/id";
import { drivers as driversTable } from "@/db/schema";
import { nanoid } from "nanoid";

function generateCollectionCode(): string {
  return nanoid(6).toUpperCase();
}

export const onboardDriverSchema = {
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
  detail: {
    tags: ["Drivers"],
    description: "",
  },
};

export const onboardDriver = async ({
  body,
  set,
}: {
  body: (typeof onboardDriverSchema)["body"]["static"];
  set: any;
}) => {
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
          collectionCode: generateCollectionCode(),
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
};
