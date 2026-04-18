import postgres from "postgres";
import * as schema from "./schema";
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

// Disable prefetch as it can cause issues in certain environments/Docker
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, {
  schema,
  // logger: true // Uncomment this to see every SQL query in your terminal
});
