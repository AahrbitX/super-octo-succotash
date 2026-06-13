import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as userTable } from "@/db/auth-schema";

export const suspendUserSchema = {
  params: t.Object({ id: t.String() }),
  body: t.Object({
    banned: t.Boolean(),
    reason: t.Optional(t.String()),
  }),
  detail: {
    tags: ["Users"],
    description: "Suspend or unsuspend a user account",
  },
};

export const suspendUser = async ({
  user,
  params,
  body,
  set,
}: {
  user: any;
  params: { id: string };
  body: { banned: boolean; reason?: string };
  set: any;
}) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Admin access required" };
  }

  const [target] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, params.id))
    .limit(1);

  if (!target) {
    set.status = 404;
    return { success: false, message: "User not found" };
  }

  await db
    .update(userTable)
    .set({
      banned: body.banned,
      bannedReason: body.banned ? (body.reason ?? null) : null,
      updatedAt: new Date(),
    } as any)
    .where(eq(userTable.id, params.id));

  logger.info(
    {
      module: "users",
      action: body.banned ? "suspend" : "unsuspend",
      targetId: params.id,
      adminId: user.id,
    },
    body.banned ? "User suspended" : "User unsuspended",
  );

  return {
    success: true,
    message: body.banned ? "User suspended" : "User unsuspended",
  };
};
