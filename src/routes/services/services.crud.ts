// src/routes/services/services.crud.ts
import { t } from "elysia";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { logger } from "@/lib/logging";

export const createServiceSchema = {
  body: t.Object({
    slug:              t.String({ minLength: 1, maxLength: 60 }),
    name:              t.String({ minLength: 1, maxLength: 100 }),
    tagline:           t.Optional(t.String({ maxLength: 200 })),
    description:       t.Optional(t.String()),
    category:          t.Union([t.Literal("ride"), t.Literal("special")]),
    formType:          t.String({ minLength: 1 }),
    serviceTab:        t.Union([t.Literal("local"), t.Literal("outstation"), t.Literal("airport")]),
    vehicleCategories: t.Array(t.String()),
    iconName:          t.Optional(t.String()),
    badge:             t.Optional(t.String()),
    active:            t.Optional(t.Boolean()),
    sortOrder:         t.Optional(t.Number()),
  }),
  detail: { tags: ["Services"], description: "Create a new service" },
};

export const updateServiceSchema = {
  body: t.Object({
    name:              t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    tagline:           t.Optional(t.String({ maxLength: 200 })),
    description:       t.Optional(t.String()),
    category:          t.Optional(t.Union([t.Literal("ride"), t.Literal("special")])),
    formType:          t.Optional(t.String()),
    serviceTab:        t.Optional(t.Union([t.Literal("local"), t.Literal("outstation"), t.Literal("airport")])),
    vehicleCategories: t.Optional(t.Array(t.String())),
    iconName:          t.Optional(t.String()),
    badge:             t.Optional(t.String()),
    active:            t.Optional(t.Boolean()),
    sortOrder:         t.Optional(t.Number()),
  }),
  detail: { tags: ["Services"], description: "Update a service" },
};

export const createService = async ({ user, body, set }: { user: any; body: any; set: any }) => {
  if (user.role !== "admin") { set.status = 403; return { success: false, message: "Forbidden" }; }

  // Check slug uniqueness
  const [existing] = await db.select({ id: services.id }).from(services).where(eq(services.slug, body.slug)).limit(1);
  if (existing) {
    set.status = 409;
    return { success: false, message: "A service with this slug already exists" };
  }

  const [svc] = await db.insert(services).values({
    id:                nanoid(),
    slug:              body.slug,
    name:              body.name,
    tagline:           body.tagline ?? "",
    description:       body.description ?? "",
    category:          body.category,
    formType:          body.formType,
    serviceTab:        body.serviceTab,
    vehicleCategories: body.vehicleCategories,
    iconName:          body.iconName ?? "IconCar",
    badge:             body.badge ?? null,
    active:            body.active ?? true,
    sortOrder:         body.sortOrder ?? 0,
  }).returning();

  logger.info({ module: "services", action: "create", slug: svc.slug }, "Service created");
  set.status = 201;
  return { success: true, data: { ...svc, locations: [] } };
};

export const updateService = async ({ user, params, body, set }: { user: any; params: { slug: string }; body: any; set: any }) => {
  if (user.role !== "admin") { set.status = 403; return { success: false, message: "Forbidden" }; }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.name              !== undefined) updates.name              = body.name;
  if (body.tagline           !== undefined) updates.tagline           = body.tagline;
  if (body.description       !== undefined) updates.description       = body.description;
  if (body.category          !== undefined) updates.category          = body.category;
  if (body.formType          !== undefined) updates.formType          = body.formType;
  if (body.serviceTab        !== undefined) updates.serviceTab        = body.serviceTab;
  if (body.vehicleCategories !== undefined) updates.vehicleCategories = body.vehicleCategories;
  if (body.iconName          !== undefined) updates.iconName          = body.iconName;
  if (body.badge             !== undefined) updates.badge             = body.badge;
  if (body.active            !== undefined) updates.active            = body.active;
  if (body.sortOrder         !== undefined) updates.sortOrder         = body.sortOrder;

  const [svc] = await db.update(services).set(updates).where(eq(services.slug, params.slug)).returning();

  if (!svc) { set.status = 404; return { success: false, message: "Service not found" }; }

  logger.info({ module: "services", action: "update", slug: params.slug }, "Service updated");
  return { success: true, data: svc };
};

export const deleteService = async ({ user, params, set }: { user: any; params: { slug: string }; set: any }) => {
  if (user.role !== "admin") { set.status = 403; return { success: false, message: "Forbidden" }; }

  const [svc] = await db.delete(services).where(eq(services.slug, params.slug)).returning({ id: services.id, slug: services.slug });
  if (!svc) { set.status = 404; return { success: false, message: "Service not found" }; }

  logger.info({ module: "services", action: "delete", slug: params.slug }, "Service deleted");
  return { success: true };
};
