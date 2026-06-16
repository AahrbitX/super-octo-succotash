import postgres from "postgres";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";
import { drizzle } from "drizzle-orm/postgres-js";

/*
File: db/index.ts

Purpose:
  - This file initializes the connection to the PostgreSQL database using the `postgres` library and sets up Drizzle ORM with our defined schema. It exports a `db` object that can be used throughout the application to interact with the database.

*/

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in your .env file");
}

// Disable prefetch as it is required for Drizzle with postgres.js
// SSL is only needed for managed cloud databases (e.g. Neon) — set DATABASE_SSL=true in that env
const client = postgres(connectionString, {
  prepare: false,
  ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
  max: 10,
});
// Added this to set schema path to public
await client`SET search_path TO public`;

export const db = drizzle(client, {
  schema: { ...schema, ...authSchema },
  // logger: true // Uncomment this to see every SQL query in your terminal
});
