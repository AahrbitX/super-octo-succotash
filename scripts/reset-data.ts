import { db } from "@/db";
import { sql } from "drizzle-orm";

console.log("🗑️  Resetting transactional data...");

await db.execute(sql`TRUNCATE TABLE payments, reviews, bookings CASCADE`);

console.log("✅ Done — payments, reviews and bookings cleared.");
console.log("   Users, drivers and places are untouched.");
