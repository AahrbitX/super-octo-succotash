import Elysia, { t } from "elysia";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";

import { driversList, driversListSchema } from "./drivers.list";
import { onboardDriver, onboardDriverSchema } from "./drivers.onboard";
import { searchDrivers, searchDriversSchema } from "./drivers.search";
import { driverDetails, driverDetailsSchema } from "./drivers.details";

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
  .get("/", driversList, driversListSchema)
  .get("/:id", driverDetails, driverDetailsSchema)
  .post("/onboard", onboardDriver, onboardDriverSchema)
  .get("/search", searchDrivers, searchDriversSchema);
