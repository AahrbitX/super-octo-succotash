import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fleetVehicles } from "@/db/schema";

export const fleetUpdateSchema = {
  body: t.Object({
    name:      t.Optional(t.String({ minLength: 1 })),
    tagline:   t.Optional(t.Nullable(t.String())),
    category:  t.Optional(t.String({ minLength: 1 })),
    image:     t.Optional(t.Nullable(t.String())),
    seats:     t.Optional(t.Number({ minimum: 1 })),
    bags:      t.Optional(t.Number({ minimum: 0 })),
    ac:        t.Optional(t.Boolean()),
    fuel:      t.Optional(t.String({ minLength: 1 })),
    features:  t.Optional(t.Array(t.String())),
    priceFrom: t.Optional(t.Nullable(t.String())),
    active:    t.Optional(t.Boolean()),
    sortOrder: t.Optional(t.Number()),
  }),
  detail: { tags: ["Fleet"], description: "Update a fleet vehicle" },
};

export const fleetUpdate = async ({ user, params, body, set }: { user: any; params: any; body: any; set: any }) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  const [row] = await db
    .update(fleetVehicles)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(fleetVehicles.id, params.id))
    .returning();

  if (!row) {
    set.status = 404;
    return { success: false, message: "Vehicle not found" };
  }

  return { success: true, data: row };
};
