import { db } from "@/db";
import { logger } from "@/lib/logging";

import { t } from "elysia";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { generateDriverId } from "@/utils/id";
import { drivers as driversTable } from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";
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
          step: "resolve_user",
        },
        "Resolving user for driver onboarding",
      );

      // Reject if this phone already belongs to any existing account
      const [existingUser] = await tx
        .select({ id: userTable.id, role: userTable.role })
        .from(userTable)
        .where(eq(userTable.phoneNumber, body.phone))
        .limit(1);

      if (existingUser) {
        set.status = 409;
        return {
          success: false,
          message:
            existingUser.role === "driver"
              ? "A driver with this phone number already exists"
              : "This phone number is already registered as a customer account",
          driverId: null,
        };
      }

      // Create a fresh account for the driver
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
        throw new Error("Failed to create auth user");
      }

      const userId = newUser.user.id;

      logger.info(
        { requestId, module: "drivers", userId },
        "New auth user created for driver",
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
          userId,
          vehicleNumber: body.vehicleNumber,
          vehicleType: body.vehicleType,
          ac: body.ac,
          isAvailable: true,
          collectionCode: generateCollectionCode(),
        })
        .returning();

      if (!newDriver) {
        logger.error(
          { requestId, module: "drivers", userId },
          "Driver profile creation failed",
        );

        throw new Error("Failed to create driver profile");
      }

      logger.info(
        { requestId, module: "drivers", driverId: newDriver.id, userId },
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
