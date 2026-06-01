import Elysia from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fleetVehicles, vehiclePricing } from "@/db/schema";

export const vehiclesRouter = new Elysia({ prefix: "/vehicles" }).get(
  "/",
  async () => {
    const [fleetRows, pricingRows] = await Promise.all([
      db
        .select()
        .from(fleetVehicles)
        .where(eq(fleetVehicles.active, true))
        .orderBy(fleetVehicles.sortOrder, fleetVehicles.createdAt),
      db.select().from(vehiclePricing),
    ]);

    const pricingMap = Object.fromEntries(
      pricingRows.map((p) => [p.vehicleType, p]),
    );

    const vehicles = fleetRows.map((v) => {
      const pricing = pricingMap[v.name];
      return {
        type:     v.name,
        category: v.category,
        seats:    v.seats,
        ac:       v.ac,
        desc:     v.tagline ?? "",
        defaultFare: pricing
          ? { amount: parseFloat(pricing.defaultAmount), unit: pricing.defaultUnit }
          : { amount: 0, unit: "per km" },
        serviceFares: pricing?.serviceFares ?? {},
      };
    });

    return { success: true, data: vehicles };
  },
  {
    detail: {
      tags: ["Vehicles"],
      description: "List all active vehicles with merged pricing (public)",
    },
  },
);
