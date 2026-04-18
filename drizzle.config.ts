import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // 1. Specify the dialect
  dialect: "postgresql",

  // 2. Path to the schema file
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],

  // 3. Where to save SQL migrations
  out: "./drizzle",

  // 4. Database credentials
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },

  // 5. Best practice: add this for safety
  verbose: true,
  strict: true,
});
