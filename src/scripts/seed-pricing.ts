/**
 * One-time seed script — populates vehicle_pricing from default catalogue.
 * Run once after drizzle:push:
 *   bun run src/scripts/seed-pricing.ts
 *
 * Safe to re-run: skips vehicle types that already exist.
 */

import { db } from "@/db";
import { vehiclePricing } from "@/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const PRICING_SEED = [
  {
    vehicleType: "Hatchback",
    defaultAmount: 9, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":      { amount: 9,    unit: "per km"    },
      "airport":        { amount: 399,  unit: "flat"      },
      "railway":        { amount: 199,  unit: "flat"      },
      "full-day-hire":  { amount: 999,  unit: "per 8 hrs" },
      "weekly-commute": { amount: 2999, unit: "per week"  },
      "rent-a-car":     { amount: 600,  unit: "per day"   },
    },
  },
  {
    vehicleType: "Hatchback (Non-AC)",
    defaultAmount: 7, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":      { amount: 7,    unit: "per km"    },
      "airport":        { amount: 299,  unit: "flat"      },
      "railway":        { amount: 149,  unit: "flat"      },
      "full-day-hire":  { amount: 799,  unit: "per 8 hrs" },
      "weekly-commute": { amount: 2499, unit: "per week"  },
    },
  },
  {
    vehicleType: "Sedan",
    defaultAmount: 12, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 12,   unit: "per km"    },
      "outstation":           { amount: 12,   unit: "per km"    },
      "outstation-oneway":    { amount: 12,   unit: "per km"    },
      "outstation-roundtrip": { amount: 12,   unit: "per km"    },
      "nationwide":           { amount: 12,   unit: "per km"    },
      "airport":              { amount: 599,  unit: "flat"      },
      "railway":              { amount: 299,  unit: "flat"      },
      "full-day-hire":        { amount: 1299, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 3999, unit: "per week"  },
      "rent-a-car":           { amount: 800,  unit: "per day"   },
      "wedding":              { amount: 5000, unit: "per day"   },
      "tours":                { amount: 3500, unit: "per day"   },
      "events":               { amount: 4000, unit: "per day"   },
    },
  },
  {
    vehicleType: "Sedan (Non-AC)",
    defaultAmount: 10, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 10,   unit: "per km"    },
      "outstation":           { amount: 10,   unit: "per km"    },
      "outstation-oneway":    { amount: 10,   unit: "per km"    },
      "outstation-roundtrip": { amount: 10,   unit: "per km"    },
      "nationwide":           { amount: 10,   unit: "per km"    },
      "airport":              { amount: 499,  unit: "flat"      },
      "railway":              { amount: 249,  unit: "flat"      },
      "full-day-hire":        { amount: 1099, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 3499, unit: "per week"  },
    },
  },
  {
    vehicleType: "MUV / Ertiga",
    defaultAmount: 16, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 16,   unit: "per km"    },
      "outstation":           { amount: 16,   unit: "per km"    },
      "outstation-oneway":    { amount: 16,   unit: "per km"    },
      "outstation-roundtrip": { amount: 16,   unit: "per km"    },
      "nationwide":           { amount: 16,   unit: "per km"    },
      "airport":              { amount: 799,  unit: "flat"      },
      "railway":              { amount: 399,  unit: "flat"      },
      "full-day-hire":        { amount: 1699, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 5499, unit: "per week"  },
      "rent-a-car":           { amount: 1200, unit: "per day"   },
      "wedding":              { amount: 7000, unit: "per day"   },
      "tours":                { amount: 5000, unit: "per day"   },
      "events":               { amount: 5500, unit: "per day"   },
    },
  },
  {
    vehicleType: "Innova / Crysta",
    defaultAmount: 18, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 18,   unit: "per km"    },
      "outstation":           { amount: 18,   unit: "per km"    },
      "outstation-oneway":    { amount: 18,   unit: "per km"    },
      "outstation-roundtrip": { amount: 18,   unit: "per km"    },
      "nationwide":           { amount: 18,   unit: "per km"    },
      "airport":              { amount: 999,  unit: "flat"      },
      "railway":              { amount: 499,  unit: "flat"      },
      "full-day-hire":        { amount: 2199, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 6999, unit: "per week"  },
      "rent-a-car":           { amount: 1500, unit: "per day"   },
      "wedding":              { amount: 9000, unit: "per day"   },
      "tours":                { amount: 6500, unit: "per day"   },
      "events":               { amount: 7000, unit: "per day"   },
    },
  },
  {
    vehicleType: "Luxury Sedan",
    defaultAmount: 24, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":   { amount: 24,    unit: "per km"    },
      "airport":     { amount: 1499,  unit: "flat"      },
      "railway":     { amount: 799,   unit: "flat"      },
      "full-day-hire":{ amount: 3499, unit: "per 8 hrs" },
      "wedding":     { amount: 12000, unit: "per day"   },
      "events":      { amount: 10000, unit: "per day"   },
    },
  },
  {
    vehicleType: "Luxury SUV",
    defaultAmount: 30, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":   { amount: 30,    unit: "per km"    },
      "airport":     { amount: 1799,  unit: "flat"      },
      "railway":     { amount: 999,   unit: "flat"      },
      "full-day-hire":{ amount: 4499, unit: "per 8 hrs" },
      "wedding":     { amount: 15000, unit: "per day"   },
      "events":      { amount: 12000, unit: "per day"   },
    },
  },
  {
    vehicleType: "Tempo Traveller",
    defaultAmount: 25, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":   { amount: 25,    unit: "per km"    },
      "outstation":  { amount: 25,    unit: "per km"    },
      "airport":     { amount: 1299,  unit: "flat"      },
      "full-day-hire":{ amount: 3999, unit: "per 8 hrs" },
      "tours":       { amount: 8000,  unit: "per day"   },
      "events":      { amount: 9000,  unit: "per day"   },
    },
  },
  {
    vehicleType: "Mini Bus",
    defaultAmount: 35, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":   { amount: 35,    unit: "per km"    },
      "outstation":  { amount: 35,    unit: "per km"    },
      "full-day-hire":{ amount: 5999, unit: "per 8 hrs" },
      "tours":       { amount: 12000, unit: "per day"   },
      "events":      { amount: 14000, unit: "per day"   },
    },
  },
];

async function seed() {
  console.log("Seeding vehicle_pricing...");
  let inserted = 0;
  let skipped  = 0;

  for (const entry of PRICING_SEED) {
    const [existing] = await db
      .select({ id: vehiclePricing.id })
      .from(vehiclePricing)
      .where(eq(vehiclePricing.vehicleType, entry.vehicleType))
      .limit(1);

    if (existing) {
      console.log(`  skip  ${entry.vehicleType} (already exists)`);
      skipped++;
      continue;
    }

    await db.insert(vehiclePricing).values({
      id:            nanoid(),
      vehicleType:   entry.vehicleType,
      defaultAmount: String(entry.defaultAmount),
      defaultUnit:   entry.defaultUnit,
      serviceFares:  entry.serviceFares,
    });

    console.log(`  added ${entry.vehicleType}`);
    inserted++;
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
