import { t } from "elysia";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as userTable } from "@/db/auth-schema";

export const updateUserSchema = {
  params: t.Object({ id: t.String() }),
  body: t.Object({
    name: t.String({ minLength: 1 }),
    phone: t.Optional(t.String()),
    dob: t.Optional(t.String()),
  }),
  detail: { tags: ["Users"], description: "Update user name, phone, and dob" },
};

export const updateUser = async ({
  user,
  params,
  body,
  set,
}: {
  user: any;
  params: { id: string };
  body: { name: string; phone?: string; dob?: string };
  set: any;
}) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Admin access required" };
  }

  const [target] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, params.id))
    .limit(1);

  if (!target) {
    set.status = 404;
    return { success: false, message: "User not found" };
  }

  // Reject if the new phone is already taken by a different account
  if (body.phone) {
    const [phoneConflict] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.phoneNumber, body.phone), ne(userTable.id, params.id)))
      .limit(1);

    if (phoneConflict) {
      set.status = 409;
      return { success: false, message: "This phone number is already in use by another account" };
    }
  }

  await db
    .update(userTable)
    .set({
      name: body.name,
      ...(body.phone ? { phoneNumber: body.phone } : {}),
      ...(body.dob ? { dob: body.dob } : {}),
      updatedAt: new Date(),
    } as any)
    .where(eq(userTable.id, params.id));

  logger.info({ module: "users", action: "update", targetId: params.id, adminId: user.id }, "User updated by admin");

  return { success: true, message: "User updated" };
};
