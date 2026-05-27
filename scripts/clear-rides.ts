/**
 * Clears all ride/booking data for a fresh test run.
 * Preserves: users, drivers, places (reference data stays intact).
 * Deletes in FK-safe order: reviews → driver_locations → payments → bookings
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";

await db.execute(sql`DELETE FROM reviews`);
await db.execute(sql`DELETE FROM driver_locations`);
await db.execute(sql`DELETE FROM payments`);
await db.execute(sql`DELETE FROM bookings`);

console.log("Cleared: reviews, driver_locations, payments, bookings.");
console.log("Users, drivers, and places are untouched.");

process.exit(0);
