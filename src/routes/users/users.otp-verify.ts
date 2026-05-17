import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { user as usersTable, session as sessionTable } from "@/db/auth-schema";
// @ts-ignore
import { makeSignature } from "better-auth/crypto";

export const otpVerifySchema = {
  body: t.Object({
    phone: t.String(),
    otp: t.String(),
  }),
  detail: {
    tags: ["Auth"],
    description: "OTP verification — any 6-digit code accepted (testing mode). Returns isNewUser flag; does NOT create new users.",
  },
};

export const otpVerify = async ({
  body,
  set,
  request,
}: {
  body: (typeof otpVerifySchema)["body"]["static"];
  set: any;
  request: Request;
}) => {
  const { phone, otp } = body;

  if (!/^\d{6}$/.test(otp)) {
    set.status = 400;
    return { success: false, message: "Please enter a valid 6-digit OTP." };
  }

  const email = `${phone.trim()}@mohan-cabs.com`;

  logger.info({ module: "auth", action: "otp-verify", phone }, "OTP verification started");

  try {
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!existingUser) {
      // New user — do NOT create yet, let them complete onboarding first
      return { success: true, isNewUser: true };
    }

    // Existing user — create session directly (no password check)
    const sessionToken = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(sessionTable).values({
      id: sessionId,
      token: sessionToken,
      userId: existingUser.id,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: request.headers.get("x-forwarded-for") ?? "",
      userAgent: request.headers.get("user-agent") ?? "",
    });

    const secret = process.env.BETTER_AUTH_SECRET!;
    const signature = await makeSignature(sessionToken, secret);
    const signedToken = `${sessionToken}.${signature}`;

    const isProd = process.env.NODE_ENV === "production";
    set.headers["set-cookie"] = [
      `mohan-cabs.session_token=${signedToken}`,
      "Path=/",
      "HttpOnly",
      `SameSite=${isProd ? "None" : "Lax"}`,
      `Max-Age=${7 * 24 * 60 * 60}`,
      ...(isProd ? ["Secure"] : []),
    ].join("; ");

    logger.info({ module: "auth", userId: existingUser.id }, "Existing user signed in via OTP");

    return { success: true, isNewUser: false };
  } catch (error: any) {
    logger.error({ module: "auth", action: "otp-verify", error: error.message }, "OTP verify failed");
    set.status = 500;
    return { success: false, message: "Something went wrong." };
  }
};
