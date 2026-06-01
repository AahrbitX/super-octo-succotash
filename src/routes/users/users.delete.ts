import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as userTable } from "@/db/auth-schema";

export const deleteUserSchema = {
  params: t.Object({ id: t.String() }),
  detail: { tags: ["Users"], description: "Delete a user account" },
};

export const deleteUser = async ({
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

  // Prevent admin from deleting themselves
  if (user.id === params.id) {
    set.status = 400;
    return { success: false, message: "Cannot delete your own account" };
  }

  const [target] = await db
    .select({ id: userTable.id, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, params.id))
    .limit(1);

  if (!target) {
    set.status = 404;
    return { success: false, message: "User not found" };
  }

  if (target.role === "driver") {
    set.status = 400;
    return { success: false, message: "Use the Drivers page to remove driver accounts" };
  }

  await db.delete(userTable).where(eq(userTable.id, params.id));

  logger.info(
    { module: "users", action: "delete", targetId: params.id, adminId: user.id },
    "User deleted by admin",
  );

  return { success: true, message: "User deleted" };
};
