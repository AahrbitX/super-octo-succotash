import { t } from "elysia";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword } from "@better-auth/utils/password";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  account as accountTable,
  verification as verificationTable,
} from "@/db/auth-schema";

export const usersSetPasswordSchema = {
  body: t.Object({
    otp: t.String(),
    newPassword: t.String({ minLength: 8 }),
  }),
  detail: {
    tags: ["Users"],
    description: "Create or reset password via OTP verification",
  },
};

export const usersSetPassword = async ({
  user,
  body,
  set,
}: {
  user: any;
  body: { otp: string; newPassword: string };
  set: any;
}) => {
  const phone = user.phoneNumber;
  if (!phone) {
    set.status = 400;
    return { success: false, message: "No phone number on account" };
  }

  // 1. Verify OTP — better-auth stores value as "{otp}:{attemptCount}" (e.g. "835816:0")
  const verifRows = await db
    .select()
    .from(verificationTable)
    .where(
      and(
        eq(verificationTable.identifier, phone),
        gt(verificationTable.expiresAt, new Date()),
      ),
    );

  const verif = verifRows.find(
    (row) => row.value.split(":")[0] === body.otp,
  );

  if (!verif) {
    set.status = 400;
    return { success: false, message: "Invalid or expired OTP" };
  }

  // 2. Hash new password using better-auth's own hashPassword function
  const hash = await hashPassword(body.newPassword);

  // 3. Upsert credential account row
  const [existing] = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, user.id),
        eq(accountTable.providerId, "credential"),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(accountTable)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(accountTable.id, existing.id));
  } else {
    await db.insert(accountTable).values({
      id: nanoid(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 4. Consume the OTP so it can't be reused
  await db
    .delete(verificationTable)
    .where(eq(verificationTable.id, verif.id));

  return {
    success: true,
    message: existing ? "Password updated successfully" : "Password created successfully",
  };
};
