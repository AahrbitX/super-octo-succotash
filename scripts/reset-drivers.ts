import { sql } from "drizzle-orm";
import { db } from "../src/db";

const result = await db.execute(sql`UPDATE drivers SET is_available = true WHERE is_available = false`);
console.log(`Reset ${(result as any).rowCount ?? "?"} driver(s) to available.`);

process.exit(0);
