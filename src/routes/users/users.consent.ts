import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as userTable } from "@/db/auth-schema";

export const updateConsentSchema = {
  body: t.Object({
    accepted: t.Boolean(),
  }),
  detail: { tags: ["Users"], description: "Save marketing consent for the current user" },
};

export const updateConsent = async ({
  user,
  body,
  set,
}: {
  user: any;
  body: { accepted: boolean };
  set: any;
}) => {
  await db
    .update(userTable)
    .set({
      marketingConsent: body.accepted,
      marketingConsentAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(eq(userTable.id, user.id));

  logger.info(
    { module: "users", action: "consent", userId: user.id, accepted: body.accepted },
    `Marketing consent ${body.accepted ? "accepted" : "declined"}`
  );

  set.status = 200;
  return { success: true };
};
