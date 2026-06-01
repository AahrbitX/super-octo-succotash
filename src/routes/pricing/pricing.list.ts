import { db } from "@/db";
import { vehiclePricing } from "@/db/schema";

export const pricingListSchema = {
  detail: { tags: ["Pricing"], description: "List all vehicle pricing" },
};

export const pricingList = async () => {
  const rows = await db
    .select()
    .from(vehiclePricing)
    .orderBy(vehiclePricing.vehicleType);

  return { success: true, data: rows };
};
