import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { account as accountTable } from "@/db/auth-schema";

export const usersHasPasswordSchema = {
  detail: {
    tags: ["Users"],
    description: "Check if authenticated user has a password set",
  },
};

export const usersHasPassword = async ({ user }: { user: any }) => {
  const [row] = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, user.id),
        eq(accountTable.providerId, "credential"),
        isNotNull(accountTable.password),
      ),
    )
    .limit(1);

  return { hasPassword: !!row };
};
