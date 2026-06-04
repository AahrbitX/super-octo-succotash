import Elysia, { t } from "elysia";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";
import { requireAdmin } from "@/lib/guards";

import { driversList, driversListSchema } from "./drivers.list";
import { updateDriver, updateDriverSchema } from "./drivers.update";
import { searchDrivers, searchDriversSchema } from "./drivers.search";
import { onboardDriver, onboardDriverSchema } from "./drivers.onboard";
import { driverDetails, driverDetailsSchema } from "./drivers.details";
import { deleteDriver, deleteDriverSchema } from "./drivers.delete";

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
  .onBeforeHandle(requireAdmin)
  .get("/", driversList, driversListSchema)
  .get("/:id", driverDetails, driverDetailsSchema)
  .post("/onboard", onboardDriver, onboardDriverSchema)
  .patch("/update/:id", updateDriver, updateDriverSchema)
  .delete("/:id", deleteDriver, deleteDriverSchema)
  .get("/search", searchDrivers, searchDriversSchema);
