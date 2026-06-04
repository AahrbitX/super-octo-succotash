import { t } from "elysia";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { vehiclePricing } from "@/db/schema";

export const pricingUpsertSchema = {
  body: t.Object({
    vehicleType:   t.String({ minLength: 1 }),
    defaultAmount: t.Number({ minimum: 0 }),
    defaultUnit:   t.String({ minLength: 1 }),
    serviceFares:  t.Record(
      t.String(),
      t.Object({ amount: t.Number(), unit: t.String() }),
    ),
  }),
  detail: { tags: ["Pricing"], description: "Create or update pricing for a vehicle type" },
};

export const pricingUpsert = async ({ user, body, set }: { user: any; body: any; set: any }) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  const [row] = await db
    .insert(vehiclePricing)
    .values({
      id:            nanoid(),
      vehicleType:   body.vehicleType,
      defaultAmount: String(body.defaultAmount),
      defaultUnit:   body.defaultUnit,
      serviceFares:  body.serviceFares,
    })
    .onConflictDoUpdate({
      target: vehiclePricing.vehicleType,
      set: {
        defaultAmount: String(body.defaultAmount),
        defaultUnit:   body.defaultUnit,
        serviceFares:  body.serviceFares,
        updatedAt:     new Date(),
      },
    })
    .returning();

  return { success: true, data: row };
};
