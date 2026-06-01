/**
 * One-time seed script — populates fleet_vehicles from default catalogue.
 * Run once after drizzle:push:
 *   bun run src/scripts/seed-fleet.ts
 *
 * Safe to re-run: skips vehicles that already exist (by name).
 */

import { db } from "@/db";
import { fleetVehicles } from "@/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const FLEET_SEED = [
  {
    name: "Maruti Swift",        tagline: "Compact · City Friendly · Budget",
    category: "Hatchback",      image: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=600&q=80",
    seats: 4, bags: 2, ac: true, fuel: "Petrol/Diesel",
    features: ["Tall Boy Design", "Easy Entry", "Budget Friendly", "City Ready"],
    priceFrom: "₹9/km", sortOrder: 1,
  },
  {
    name: "Maruti Alto",         tagline: "Economy · Compact · Short Trips",
    category: "Hatchback",      image: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=600&q=80",
    seats: 4, bags: 2, ac: true, fuel: "Petrol",
    features: ["Low Maintenance", "Fuel Efficient", "Easy Parking", "Budget Pick"],
    priceFrom: "₹8/km", sortOrder: 2,
  },
  {
    name: "Maruti Ritz",         tagline: "Premium Hatchback · City & Outstation",
    category: "Hatchback",      image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&q=80",
    seats: 4, bags: 2, ac: true, fuel: "Diesel",
    features: ["Tall Boy Design", "Easy Entry", "Budget", "Outstation Ready"],
    priceFrom: "₹10/km", sortOrder: 3,
  },
  {
    name: "Maruti Dzire",        tagline: "Comfortable · Popular · Reliable",
    category: "Sedan",           image: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600&q=80",
    seats: 4, bags: 3, ac: true, fuel: "Petrol/CNG",
    features: ["Spacious Boot", "Smooth Ride", "Fuel Efficient", "Most Booked"],
    priceFrom: "₹12/km", sortOrder: 4,
  },
  {
    name: "Toyota Etios",        tagline: "Reliable · Roomy · Long Trips",
    category: "Sedan",           image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600&q=80",
    seats: 4, bags: 3, ac: true, fuel: "Diesel",
    features: ["Large Cabin", "Low Noise", "Highway Comfort", "Toyota Quality"],
    priceFrom: "₹13/km", sortOrder: 5,
  },
  {
    name: "Hyundai Xcent",       tagline: "Elegant · Comfortable · Smart",
    category: "Sedan",           image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80",
    seats: 4, bags: 3, ac: true, fuel: "Diesel",
    features: ["Premium Interior", "Touchscreen", "Cruise Control", "Bluetooth"],
    priceFrom: "₹13/km", sortOrder: 6,
  },
  {
    name: "Maruti Ertiga",       tagline: "Family · 7 Seater · Versatile",
    category: "MUV",             image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80",
    seats: 6, bags: 4, ac: true, fuel: "Petrol/CNG",
    features: ["3-Row Seating", "Sliding Doors", "Family Friendly", "Luggage Space"],
    priceFrom: "₹16/km", sortOrder: 7,
  },
  {
    name: "Toyota Innova",       tagline: "Premium MUV · Group Travel · Outstation",
    category: "MUV",             image: "https://images.unsplash.com/photo-1518987048-93e29699e79a?w=600&q=80",
    seats: 7, bags: 5, ac: true, fuel: "Diesel",
    features: ["Premium Cabin", "Captain Seats", "Long Range", "Top Rated"],
    priceFrom: "₹18/km", sortOrder: 8,
  },
  {
    name: "Innova Crysta",       tagline: "Executive · Spacious · Premium",
    category: "MUV",             image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&q=80",
    seats: 7, bags: 5, ac: true, fuel: "Diesel",
    features: ["Leather Seats", "Sunroof", "Premium Audio", "Executive Look"],
    priceFrom: "₹20/km", sortOrder: 9,
  },
  {
    name: "Toyota Camry",        tagline: "Executive · Hybrid · Ultra-Smooth",
    category: "Luxury",          image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=600&q=80",
    seats: 4, bags: 3, ac: true, fuel: "Hybrid",
    features: ["Leather Interior", "Ambient Lighting", "Quiet Cabin", "Chauffeur Ready"],
    priceFrom: "₹24/km", sortOrder: 10,
  },
  {
    name: "BMW 5 Series",        tagline: "Luxury · Business Class · Prestige",
    category: "Luxury",          image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80",
    seats: 4, bags: 3, ac: true, fuel: "Petrol",
    features: ["Premium Leather", "Panoramic Roof", "Massage Seats", "VIP Experience"],
    priceFrom: "₹40/km", sortOrder: 11,
  },
  {
    name: "Tempo Traveller",     tagline: "Group · 12 Seater · Tours",
    category: "Traveller",       image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&q=80",
    seats: 12, bags: 8, ac: true, fuel: "Diesel",
    features: ["Push-Back Seats", "Roof Carrier", "Group Tours", "Pilgrimage Ready"],
    priceFrom: "₹25/km", sortOrder: 12,
  },
];

async function seed() {
  console.log("Seeding fleet_vehicles...");
  let inserted = 0;
  let skipped  = 0;

  for (const vehicle of FLEET_SEED) {
    const [existing] = await db
      .select({ id: fleetVehicles.id })
      .from(fleetVehicles)
      .where(eq(fleetVehicles.name, vehicle.name))
      .limit(1);

    if (existing) {
      console.log(`  skip  ${vehicle.name} (already exists)`);
      skipped++;
      continue;
    }

    await db.insert(fleetVehicles).values({
      id:        nanoid(),
      name:      vehicle.name,
      tagline:   vehicle.tagline,
      category:  vehicle.category,
      image:     vehicle.image,
      seats:     vehicle.seats,
      bags:      vehicle.bags,
      ac:        vehicle.ac,
      fuel:      vehicle.fuel,
      features:  vehicle.features,
      priceFrom: vehicle.priceFrom,
      sortOrder: vehicle.sortOrder,
    });

    console.log(`  added ${vehicle.name}`);
    inserted++;
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
