// src/routes/services/index.ts
import Elysia from "elysia";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/guards";
import { servicesList, servicesGet } from "./services.list";
import { createService, createServiceSchema, updateService, updateServiceSchema, deleteService } from "./services.crud";
import { addLocation, addLocationSchema, deleteLocation } from "./services.locations";

export const servicesRouter = new Elysia({ prefix: "/services" })
  // Public — anyone can read services + locations
  .get("/",      servicesList)
  .get("/:slug", servicesGet)

  // Admin-only — CRUD + locations
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
      .post("/",                                createService,  createServiceSchema)
      .patch("/:slug",                          updateService,  updateServiceSchema)
      .delete("/:slug",                         deleteService)
      .post("/:slug/locations",                 addLocation,    addLocationSchema)
      .delete("/:slug/locations/:locationId",   deleteLocation),
  );
