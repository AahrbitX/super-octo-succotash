import Elysia from "elysia";

import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";

import { dispatchersList, dispatchersListSchema } from "./dispatchers.list";
import {
  dispatcherTripDetails,
  dispatcherTripDetailsSchema,
} from "./dispatchers.details";
import {
  dispatcherSuggestedDrivers,
  dispatcherSuggestedDriversSchema,
} from "./dispatchers.drivers";
import {
  dispatcherAssignDriver,
  dispatcherAssignDriverSchema,
} from "./dispatchers.assign-driver";

export const dispatchersRouter = new Elysia({ prefix: "/dispatchers" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session) {
      logger.warn(
        {
          module: "bookings",
          action: "auth",
          status: 401,
        },
        "Unauthorized access attempt",
      );
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .get("/", dispatchersList, dispatchersListSchema)
  .get("/:bookingId", dispatcherTripDetails, dispatcherTripDetailsSchema)
  .get(
    "/:bookingId/drivers",
    dispatcherSuggestedDrivers,
    dispatcherSuggestedDriversSchema,
  )
  .post(
    "/:bookingId/assign-driver",
    dispatcherAssignDriver,
    dispatcherAssignDriverSchema,
  );
