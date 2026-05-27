// TEMPORARY DEBUG — remove after confirming password flow works
import { t } from "elysia";
import { eq, and } from "drizzle-orm";
import { verifyPassword as verifyPasswordBA } from "@better-auth/utils/password";
import { db } from "@/db";
import { account as accountTable, user as userTable } from "@/db/auth-schema";

export const usersDebugVerifySchema = {
  body: t.Object({ password: t.String() }),
  detail: { tags: ["Users"], description: "DEBUG: verify password against stored hash" },
};

export const usersDebugVerify = async ({
  user,
  body,
}: {
  user: any;
  body: { password: string };
}) => {
  // Fetch the credential account row
  const [account] = await db
    .select({ id: accountTable.id, password: accountTable.password })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, user.id),
        eq(accountTable.providerId, "credential"),
      ),
    )
    .limit(1);

  // Fetch the user's email
  const [dbUser] = await db
    .select({ email: userTable.email, phoneNumber: userTable.phoneNumber })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);

  if (!account?.password) {
    return {
      hasCredentialAccount: false,
      email: dbUser?.email,
      phoneNumber: dbUser?.phoneNumber,
    };
  }

  const hashPreview = account.password.substring(0, 20) + "...";
  const match = await verifyPasswordBA(account.password, body.password);

  console.log("[DEBUG verify] user.id:", user.id);
  console.log("[DEBUG verify] email:", dbUser?.email);
  console.log("[DEBUG verify] phoneNumber:", dbUser?.phoneNumber);
  console.log("[DEBUG verify] stored hash preview:", hashPreview);
  console.log("[DEBUG verify] password tested:", body.password);
  console.log("[DEBUG verify] match:", match);

  return {
    hasCredentialAccount: true,
    email: dbUser?.email,
    phoneNumber: dbUser?.phoneNumber,
    hashPreview,
    match,
  };
};
