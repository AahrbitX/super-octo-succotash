/**
 * Seed script — populates vehicle_pricing keyed by fleet vehicle name.
 * vehicle_pricing.vehicleType must match fleet_vehicles.name exactly.
 *
 * Safe to re-run: upserts on conflict.
 *   bun run src/scripts/seed-pricing.ts
 */

import { db } from "@/db";
import { vehiclePricing } from "@/db/schema";
import { nanoid } from "nanoid";

type ServiceFares = Record<string, { amount: number; unit: string }>;

const PRICING_SEED: { vehicleType: string; defaultAmount: number; defaultUnit: string; serviceFares: ServiceFares }[] = [
  // ── Hatchback ────────────────────────────────────────────────────────────────
  {
    vehicleType: "Maruti Swift",
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
    vehicleType: "Maruti Alto",
    defaultAmount: 8, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":      { amount: 8,    unit: "per km"    },
      "airport":        { amount: 349,  unit: "flat"      },
      "railway":        { amount: 179,  unit: "flat"      },
      "full-day-hire":  { amount: 899,  unit: "per 8 hrs" },
      "weekly-commute": { amount: 2699, unit: "per week"  },
      "rent-a-car":     { amount: 550,  unit: "per day"   },
    },
  },
  {
    vehicleType: "Maruti Ritz",
    defaultAmount: 10, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 10,   unit: "per km"    },
      "outstation":           { amount: 10,   unit: "per km"    },
      "airport":              { amount: 449,  unit: "flat"      },
      "railway":              { amount: 229,  unit: "flat"      },
      "full-day-hire":        { amount: 1099, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 3299, unit: "per week"  },
      "rent-a-car":           { amount: 650,  unit: "per day"   },
    },
  },

  // ── Sedan ────────────────────────────────────────────────────────────────────
  {
    vehicleType: "Maruti Dzire",
    defaultAmount: 12, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 12,   unit: "per km"    },
      "outstation":           { amount: 12,   unit: "per km"    },
      "outstation-oneway":    { amount: 12,   unit: "per km"    },
      "outstation-roundtrip": { amount: 12,   unit: "per km"    },
      "airport":              { amount: 599,  unit: "flat"      },
      "railway":              { amount: 299,  unit: "flat"      },
      "full-day-hire":        { amount: 1299, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 3999, unit: "per week"  },
      "rent-a-car":           { amount: 800,  unit: "per day"   },
      "wedding":              { amount: 5000, unit: "per day"   },
      "tours":                { amount: 3500, unit: "per day"   },
    },
  },
  {
    vehicleType: "Toyota Etios",
    defaultAmount: 13, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 13,   unit: "per km"    },
      "outstation":           { amount: 13,   unit: "per km"    },
      "outstation-oneway":    { amount: 13,   unit: "per km"    },
      "outstation-roundtrip": { amount: 13,   unit: "per km"    },
      "airport":              { amount: 649,  unit: "flat"      },
      "railway":              { amount: 329,  unit: "flat"      },
      "full-day-hire":        { amount: 1399, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 4299, unit: "per week"  },
      "rent-a-car":           { amount: 850,  unit: "per day"   },
      "wedding":              { amount: 5500, unit: "per day"   },
      "tours":                { amount: 3800, unit: "per day"   },
    },
  },
  {
    vehicleType: "Hyundai Xcent",
    defaultAmount: 13, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 13,   unit: "per km"    },
      "outstation":           { amount: 13,   unit: "per km"    },
      "outstation-oneway":    { amount: 13,   unit: "per km"    },
      "outstation-roundtrip": { amount: 13,   unit: "per km"    },
      "airport":              { amount: 649,  unit: "flat"      },
      "railway":              { amount: 329,  unit: "flat"      },
      "full-day-hire":        { amount: 1399, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 4299, unit: "per week"  },
      "rent-a-car":           { amount: 850,  unit: "per day"   },
      "wedding":              { amount: 5500, unit: "per day"   },
      "tours":                { amount: 3800, unit: "per day"   },
    },
  },

  // ── MUV ──────────────────────────────────────────────────────────────────────
  {
    vehicleType: "Maruti Ertiga",
    defaultAmount: 16, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 16,   unit: "per km"    },
      "outstation":           { amount: 16,   unit: "per km"    },
      "outstation-oneway":    { amount: 16,   unit: "per km"    },
      "outstation-roundtrip": { amount: 16,   unit: "per km"    },
      "airport":              { amount: 799,  unit: "flat"      },
      "railway":              { amount: 399,  unit: "flat"      },
      "full-day-hire":        { amount: 1699, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 5499, unit: "per week"  },
      "rent-a-car":           { amount: 1200, unit: "per day"   },
      "wedding":              { amount: 7000, unit: "per day"   },
      "tours":                { amount: 5000, unit: "per day"   },
    },
  },
  {
    vehicleType: "Toyota Innova",
    defaultAmount: 18, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 18,   unit: "per km"    },
      "outstation":           { amount: 18,   unit: "per km"    },
      "outstation-oneway":    { amount: 18,   unit: "per km"    },
      "outstation-roundtrip": { amount: 18,   unit: "per km"    },
      "airport":              { amount: 999,  unit: "flat"      },
      "railway":              { amount: 499,  unit: "flat"      },
      "full-day-hire":        { amount: 2199, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 6999, unit: "per week"  },
      "rent-a-car":           { amount: 1500, unit: "per day"   },
      "wedding":              { amount: 9000, unit: "per day"   },
      "tours":                { amount: 6500, unit: "per day"   },
    },
  },
  {
    vehicleType: "Innova Crysta",
    defaultAmount: 20, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":            { amount: 20,   unit: "per km"    },
      "outstation":           { amount: 20,   unit: "per km"    },
      "outstation-oneway":    { amount: 20,   unit: "per km"    },
      "outstation-roundtrip": { amount: 20,   unit: "per km"    },
      "airport":              { amount: 1099, unit: "flat"      },
      "railway":              { amount: 549,  unit: "flat"      },
      "full-day-hire":        { amount: 2499, unit: "per 8 hrs" },
      "weekly-commute":       { amount: 7999, unit: "per week"  },
      "rent-a-car":           { amount: 1800, unit: "per day"   },
      "wedding":              { amount: 10000, unit: "per day"  },
      "tours":                { amount: 7500, unit: "per day"   },
    },
  },

  // ── Luxury ───────────────────────────────────────────────────────────────────
  {
    vehicleType: "Toyota Camry",
    defaultAmount: 24, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":    { amount: 24,    unit: "per km"    },
      "airport":      { amount: 1499,  unit: "flat"      },
      "railway":      { amount: 799,   unit: "flat"      },
      "full-day-hire":{ amount: 3499,  unit: "per 8 hrs" },
      "wedding":      { amount: 12000, unit: "per day"   },
      "events":       { amount: 10000, unit: "per day"   },
    },
  },
  {
    vehicleType: "BMW 5 Series",
    defaultAmount: 40, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":    { amount: 40,    unit: "per km"    },
      "airport":      { amount: 1999,  unit: "flat"      },
      "railway":      { amount: 999,   unit: "flat"      },
      "full-day-hire":{ amount: 5999,  unit: "per 8 hrs" },
      "wedding":      { amount: 18000, unit: "per day"   },
      "events":       { amount: 15000, unit: "per day"   },
    },
  },

  // ── Traveller ─────────────────────────────────────────────────────────────────
  {
    vehicleType: "Tempo Traveller",
    defaultAmount: 25, defaultUnit: "per km",
    serviceFares: {
      "city-taxi":    { amount: 25,    unit: "per km"    },
      "outstation":   { amount: 25,    unit: "per km"    },
      "airport":      { amount: 1299,  unit: "flat"      },
      "full-day-hire":{ amount: 3999,  unit: "per 8 hrs" },
      "tours":        { amount: 8000,  unit: "per day"   },
      "events":       { amount: 9000,  unit: "per day"   },
    },
  },
];

export async function seedPricing() {
  console.log("Seeding vehicle_pricing...");
  let upserted = 0;

  for (const entry of PRICING_SEED) {
    await db
      .insert(vehiclePricing)
      .values({
        id:            nanoid(),
        vehicleType:   entry.vehicleType,
        defaultAmount: String(entry.defaultAmount),
        defaultUnit:   entry.defaultUnit,
        serviceFares:  entry.serviceFares,
      })
      .onConflictDoUpdate({
        target: vehiclePricing.vehicleType,
        set: {
          defaultAmount: String(entry.defaultAmount),
          defaultUnit:   entry.defaultUnit,
          serviceFares:  entry.serviceFares,
          updatedAt:     new Date(),
        },
      });

    console.log(`  upserted ${entry.vehicleType}`);
    upserted++;
  }

  console.log(`Done. ${upserted} upserted.`);
}

// Standalone entry point
if (import.meta.main) {
  seedPricing().then(() => process.exit(0)).catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
