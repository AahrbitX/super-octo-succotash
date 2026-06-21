// src/routes/services/services.locations.ts
import { t } from "elysia";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { services, serviceLocations } from "@/db/schema";
import { logger } from "@/lib/logging";

export const addLocationSchema = {
  body: t.Object({
    locationType: t.Union([t.Literal("pickup"), t.Literal("drop"), t.Literal("both")]),
    name:         t.String({ minLength: 1, maxLength: 150 }),
    sublabel:     t.Optional(t.String({ maxLength: 100 })),
    lat:          t.Optional(t.Number()),
    lng:          t.Optional(t.Number()),
    sortOrder:    t.Optional(t.Number()),
  }),
  detail: { tags: ["Services"], description: "Add a fixed location to a service" },
};

export const addLocation = async ({ user, params, body, set }: { user: any; params: { slug: string }; body: any; set: any }) => {
  if (user.role !== "admin") { set.status = 403; return { success: false, message: "Forbidden" }; }

  const [svc] = await db.select({ id: services.id }).from(services).where(eq(services.slug, params.slug)).limit(1);
  if (!svc) { set.status = 404; return { success: false, message: "Service not found" }; }

  const [loc] = await db.insert(serviceLocations).values({
    id:           nanoid(),
    serviceId:    svc.id,
    locationType: body.locationType,
    name:         body.name,
    sublabel:     body.sublabel ?? null,
    lat:          body.lat != null ? String(body.lat) : null,
    lng:          body.lng != null ? String(body.lng) : null,
    sortOrder:    body.sortOrder ?? 0,
  }).returning();

  logger.info({ module: "services", action: "add_location", slug: params.slug, locationId: loc.id }, "Location added");
  set.status = 201;
  return { success: true, data: loc };
};

export const deleteLocation = async ({ user, params, set }: { user: any; params: { slug: string; locationId: string }; set: any }) => {
  if (user.role !== "admin") { set.status = 403; return { success: false, message: "Forbidden" }; }

  const [svc] = await db.select({ id: services.id }).from(services).where(eq(services.slug, params.slug)).limit(1);
  if (!svc) { set.status = 404; return { success: false, message: "Service not found" }; }

  const [loc] = await db
    .delete(serviceLocations)
    .where(and(eq(serviceLocations.id, params.locationId), eq(serviceLocations.serviceId, svc.id)))
    .returning({ id: serviceLocations.id });

  if (!loc) { set.status = 404; return { success: false, message: "Location not found" }; }

  logger.info({ module: "services", action: "delete_location", slug: params.slug, locationId: params.locationId }, "Location deleted");
  return { success: true };
};
