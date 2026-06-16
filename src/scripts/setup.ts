/**
 * Fresh deployment setup script.
 * Runs schema push then seeds all default data in one command:
 *   bun run db:setup
 *
 * Safe to re-run — all seeds skip existing records.
 */

import { seedFleet }   from "./seed-fleet";
import { seedPricing } from "./seed-pricing";
import { seedAdmin }   from "../db/admin-seed";

async function setup() {
  console.log("\n=== Mohan Cabs DB Setup ===\n");
  await seedFleet();
  console.log();
  await seedPricing();
  console.log();
  await seedAdmin();
  console.log("\n=== Setup complete ===\n");
  process.exit(0);
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
