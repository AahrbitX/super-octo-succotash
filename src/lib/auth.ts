import { db } from "../db";
import * as schema from "../db/schema";
import * as authSchema from "../db/auth-schema";

// better Auth imports
import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import { sendLoginOtp } from "./whatsapp";
import { logger } from "./logging";

/* 
File: auth.ts

Purpose:
  -  This file sets up Better Auth for our Elysia application, using Drizzle ORM to connect to our PostgreSQL database. It also configures phone number authentication with OTP via Fast2SMS.

  - This module exports an `auth` object that contains both the Better Auth API and the Elysia middleware handler.
*/

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // PostgreSQL provider
    schema: { ...schema, ...authSchema },
  }),
  basePath: "/api/auth",
  trustedOrigins: ["http://localhost:3000", process.env.FRONTEND_URL || ""],
  user: {
    additionalFields: {
      role:              { type: "string",  defaultValue: "user" },
      dob:               { type: "string",  required: false },
      gender:            { type: "string",  required: false },
      marketingConsent:  { type: "boolean", required: false },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";
        const SMS_PROVIDER_KEY = process.env.FAST2SMS_API_KEY;

        if (WHATSAPP_ENABLED) {
          // Primary: WhatsApp OTP (login_otp Authentication template)
          await sendLoginOtp({ phone: phoneNumber, code });
          return;
        }

        if (SMS_PROVIDER_KEY) {
          // Fallback: Fast2SMS
          const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${SMS_PROVIDER_KEY}&variables_values=${code}&route=otp&numbers=${phoneNumber}`;
          const response = await fetch(url);
          const result: any = await response.json();
          if (!result.return) {
            throw new Error(`Fast2SMS Error: ${result.message}`);
          }
          return;
        }

        // Dev mode: log OTP visibly
        logger.info(
          { module: "auth", action: "login_otp", phone: phoneNumber, otp: code },
          [
            ``,
            `  ┌─ [DEV Login OTP] ${"─".repeat(42)}`,
            `  │  Phone : ${phoneNumber}`,
            `  │  OTP   : ${code}`,
            `  └${"─".repeat(58)}`,
            ``,
          ].join("\n"),
        );
      },
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => `${phoneNumber}@mohan-cabs.com`,
        // Phone number is used as temp name — frontend detects new users by checking this
        getTempName: (phoneNumber) => phoneNumber,
      },
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [u] = await db
            .select({ banned: authSchema.user.banned })
            .from(authSchema.user)
            .where(eq(authSchema.user.id, session.userId))
            .limit(1);
          if (u?.banned) {
            throw new Error("Your account has been suspended. Please contact support.");
          }
        },
      },
    },
  },
  // For local dev, you can disable HTTPS requirement
  advanced: {
    cookiePrefix: "mohan-cabs",
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  },
});
