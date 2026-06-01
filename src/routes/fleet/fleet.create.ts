import { t } from "elysia";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { fleetVehicles } from "@/db/schema";

export const fleetCreateSchema = {
  body: t.Object({
    name:      t.String({ minLength: 1 }),
    tagline:   t.Optional(t.String()),
    category:  t.String({ minLength: 1 }),
    image:     t.Optional(t.String()),
    seats:     t.Number({ minimum: 1 }),
    bags:      t.Number({ minimum: 0 }),
    ac:        t.Boolean(),
    fuel:      t.String({ minLength: 1 }),
    features:  t.Array(t.String()),
    priceFrom: t.Optional(t.String()),
    sortOrder: t.Optional(t.Number()),
  }),
  detail: { tags: ["Fleet"], description: "Create a fleet vehicle" },
};

export const fleetCreate = async ({ user, body, set }: { user: any; body: any; set: any }) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  const [row] = await db
    .insert(fleetVehicles)
    .values({
      id:        nanoid(),
      name:      body.name,
      tagline:   body.tagline ?? null,
      category:  body.category,
      image:     body.image ?? null,
      seats:     body.seats,
      bags:      body.bags,
      ac:        body.ac,
      fuel:      body.fuel,
      features:  body.features,
      priceFrom: body.priceFrom ?? null,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();

  return { success: true, data: row };
};
