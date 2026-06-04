import Elysia from "elysia";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/guards";

import { fleetList, fleetListSchema } from "./fleet.list";
import { fleetCreate, fleetCreateSchema } from "./fleet.create";
import { fleetUpdate, fleetUpdateSchema } from "./fleet.update";
import { fleetDelete, fleetDeleteSchema } from "./fleet.delete";

export const fleetRouter = new Elysia({ prefix: "/fleet" })
  // Public: anyone can list fleet vehicles
  .get("/", fleetList, fleetListSchema)
  // Admin-only: create / update / delete
  .guard({}, (app) =>
    app
      .derive(async ({ request, set }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          set.status = 401;
          throw new Error("Unauthorized");
        }
        return { user: session.user };
      })
      .onBeforeHandle(requireAdmin)
      .post("/", fleetCreate, fleetCreateSchema)
      .patch("/:id", fleetUpdate, fleetUpdateSchema)
      .delete("/:id", fleetDelete, fleetDeleteSchema)
  );
