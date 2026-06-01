import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fleetVehicles } from "@/db/schema";

export const fleetDeleteSchema = {
  detail: { tags: ["Fleet"], description: "Delete a fleet vehicle" },
};

export const fleetDelete = async ({ user, params, set }: { user: any; params: any; set: any }) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  const [row] = await db
    .delete(fleetVehicles)
    .where(eq(fleetVehicles.id, params.id))
    .returning({ id: fleetVehicles.id });

  if (!row) {
    set.status = 404;
    return { success: false, message: "Vehicle not found" };
  }

  return { success: true, message: "Vehicle deleted" };
};
