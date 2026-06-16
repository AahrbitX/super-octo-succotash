import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { drivers as driversTable } from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";

export const deleteDriverSchema = {
  params: t.Object({ id: t.String() }),
  detail: { tags: ["Drivers"], description: "Delete a driver and revert their account to user role" },
};

export const deleteDriver = async ({
  user,
  params,
  set,
}: {
  user: any;
  params: { id: string };
  set: any;
}) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Admin access required" };
  }

  const [driver] = await db
    .select({ id: driversTable.id, userId: driversTable.userId, isDeleted: driversTable.isDeleted })
    .from(driversTable)
    .where(eq(driversTable.id, params.id))
    .limit(1);

  if (!driver || driver.isDeleted) {
    set.status = 404;
    return { success: false, message: "Driver not found" };
  }

  await db.transaction(async (tx) => {
    // Soft-delete driver profile
    await tx
      .update(driversTable)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(driversTable.id, params.id));
    // Revert user role to "user"
    await tx
      .update(userTable)
      .set({ role: "user", updatedAt: new Date() } as any)
      .where(eq(userTable.id, driver.userId));
  });

  logger.info({ module: "drivers", action: "delete", driverId: params.id, adminId: user.id }, "Driver soft-deleted");

  return { success: true, message: "Driver removed successfully" };
};
