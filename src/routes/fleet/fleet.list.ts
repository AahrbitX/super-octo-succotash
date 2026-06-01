import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fleetVehicles } from "@/db/schema";

export const fleetListSchema = {
  detail: { tags: ["Fleet"], description: "List all fleet vehicles" },
};

export const fleetList = async () => {
  const rows = await db
    .select()
    .from(fleetVehicles)
    .orderBy(fleetVehicles.sortOrder, fleetVehicles.createdAt);

  return { success: true, data: rows };
};
