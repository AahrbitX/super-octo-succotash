import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as userTable } from "@/db/auth-schema";

export const updateMeSchema = {
  body: t.Object({
    name:   t.Optional(t.String({ minLength: 1 })),
    gender: t.Optional(t.String()),
  }),
  detail: { tags: ["Users"], description: "Update own name and gender" },
};

export const updateMe = async ({
  user,
  body,
}: {
  user: any;
  body: { name?: string; gender?: string };
}) => {
  await db
    .update(userTable)
    .set({
      ...(body.name   ? { name: body.name }     : {}),
      ...(body.gender !== undefined ? { gender: body.gender } : {}),
      updatedAt: new Date(),
    } as any)
    .where(eq(userTable.id, user.id));

  logger.info({ module: "users", action: "update-me", userId: user.id }, "User updated own profile");

  return { success: true };
};
