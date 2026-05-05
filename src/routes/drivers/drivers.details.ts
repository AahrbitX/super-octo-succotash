import { t } from "elysia";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logging";

import { db } from "@/db";
import { drivers as driversTable } from "@/db/schema";
import { user as usersTable } from "@/db/auth-schema";

export const driverDetailsSchema = {
  params: t.Object({
    id: t.String(),
  }),
  response: {
    404: t.Object({
      success: t.Boolean(),
      message: t.String(),
    }),
  },
  detail: {
    tags: ["Drivers"],
    description: "",
  },
};

export const driverDetails = async ({
  params,
  set,
}: {
  params: (typeof driverDetailsSchema)["params"]["static"];
  set: any;
}) => {
  logger.info(
    {
      module: "drivers",
      action: "get_one",
      driverId: params.id,
    },
    "Fetching driver by id",
  );

  const [driver] = await db
    .select()
    .from(driversTable)
    .innerJoin(usersTable, eq(driversTable.userId, usersTable.id))
    .where(eq(driversTable.id, params.id))
    .limit(1);

  if (!driver) {
    logger.warn(
      {
        module: "drivers",
        action: "get_one",
        driverId: params.id,
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
      driverId: params.id,
    },
    "Driver fetched successfully",
  );

  return {
    success: true,
    data: driver,
  };
};
