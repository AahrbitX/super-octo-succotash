import { db } from "../db";
import * as schema from "../db/schema";
import * as authSchema from "../db/auth-schema";

// better Auth imports
import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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
      role: { type: "string", defaultValue: "user" },
      dob: { type: "string" },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    phoneNumber({
      // 1. This function is called whenever Better Auth needs to send an OTP
      sendOTP: async ({ phoneNumber, code }) => {
        const SMS_PROVIDER_KEY = process.env.FAST2SMS_API_KEY;
        const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${SMS_PROVIDER_KEY}&variables_values=${code}&route=otp&numbers=${phoneNumber}`;

        const response = await fetch(url);
        const result: any = await response.json();

        if (!result.return) {
          throw new Error(`Fast2SMS Error: ${result.message}`);
        }
      },
      // 2. This creates a user automatically if they don't exist
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => `${phoneNumber}@mohan-cabs.com`,
      },
    }),
  ],
  // For local dev, you can disable HTTPS requirement
  advanced: {
    cookiePrefix: "mohan-cabs",
  },
});
