import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";
import { user as usersTable, session as sessionTable } from "@/db/auth-schema";
// @ts-ignore
import { makeSignature } from "better-auth/crypto";

export const otpCompleteSchema = {
  body: t.Object({
    phone: t.String(),
    name: t.String(),
    dob: t.Optional(t.String()),
  }),
  detail: {
    tags: ["Auth"],
    description: "Complete OTP registration — creates user account and session after onboarding form is submitted.",
  },
};

export const otpComplete = async ({
  body,
  set,
  request,
}: {
  body: (typeof otpCompleteSchema)["body"]["static"];
  set: any;
  request: Request;
}) => {
  const { phone, name, dob } = body;

  if (!name.trim()) {
    set.status = 400;
    return { success: false, message: "Full name is required." };
  }

  const email = `${phone.trim()}@mohan-cabs.com`;
  const password = phone.trim();

  logger.info({ module: "auth", action: "otp-complete", phone }, "Onboarding completion started");

  try {
    // Check if user was already created (e.g. double submit)
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      logger.info({ module: "auth", userId }, "User already exists, skipping creation");
    } else {
      // Create user via better-auth so it handles password hashing + account record
      const signUpResult = await auth.api.signUpEmail({
        body: {
          name: name.trim(),
          email,
          password,
          dob: dob || null,
        } as any,
      });

      if (!signUpResult?.user) {
        set.status = 400;
        return { success: false, message: "Failed to create account." };
      }

      userId = signUpResult.user.id;
      logger.info({ module: "auth", userId }, "New user created via onboarding");
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(sessionTable).values({
      id: sessionId,
      token: sessionToken,
      userId,
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

    set.status = 201;
    return { success: true };
  } catch (error: any) {
    logger.error({ module: "auth", action: "otp-complete", error: error.message }, "Onboarding failed");
    set.status = 500;
    return { success: false, message: "Something went wrong." };
  }
};
