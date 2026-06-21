// src/db/services-seed.ts
// One-time seed: populates the services table from the frontend mock data + serviceConfig metadata.
// Run with: bun src/db/services-seed.ts
import { db } from "../db";
import { services, serviceLocations } from "./schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const SEED_SERVICES = [
  // ── Book A Ride ────────────────────────────────────────────────────────────
  {
    slug: "city-taxi", name: "City Taxi",
    tagline: "Quick rides within the city", description: "Quick, reliable rides anywhere within the city. Metered fare, no surge pricing. Available 24×7 for immediate bookings or scheduled trips.",
    category: "ride", formType: "standard", serviceTab: "local",
    vehicleCategories: ["Hatchback", "Sedan", "MUV"],
    iconName: "IconCar", badge: "Most Popular", active: true, sortOrder: 0,
  },
  {
    slug: "rent-a-car", name: "Rent a Car",
    tagline: "Self-drive options", description: "Self-drive options with well-maintained vehicles. Hourly and daily packages available.",
    category: "ride", formType: "hire", serviceTab: "local",
    vehicleCategories: ["Hatchback", "Sedan", "MUV", "Luxury"],
    iconName: "IconKey", badge: null, active: true, sortOrder: 1,
  },
  {
    slug: "outstation", name: "Outstation",
    tagline: "Inter-city travel packages", description: "One-way and round-trip inter-city travel packages at flat, transparent fares.",
    category: "ride", formType: "outstation", serviceTab: "outstation",
    vehicleCategories: ["Sedan", "MUV", "Luxury"],
    iconName: "IconNavigation", badge: "Best Value", active: true, sortOrder: 2,
  },
  {
    slug: "outstation-oneway", name: "One-Way Drop",
    tagline: "One-way outstation trip", description: "Travel to your destination without worrying about return fare.",
    category: "ride", formType: "outstation", serviceTab: "outstation",
    vehicleCategories: ["Sedan", "MUV", "Luxury"],
    iconName: "IconNavigation", badge: null, active: true, sortOrder: 3,
  },
  {
    slug: "outstation-roundtrip", name: "Round Trip Package",
    tagline: "Go and come back on your schedule", description: "Go and come back at your own schedule. Driver waits for you at the destination.",
    category: "ride", formType: "outstation", serviceTab: "outstation",
    vehicleCategories: ["Sedan", "MUV", "Luxury"],
    iconName: "IconNavigation", badge: null, active: true, sortOrder: 4,
  },
  {
    slug: "airport", name: "Airport Transfer",
    tagline: "Reliable pickup & drop", description: "Flight-tracked pickups and drops. Fixed price, no waiting charges. Meet & greet service available.",
    category: "ride", formType: "airport", serviceTab: "airport",
    vehicleCategories: ["Sedan", "MUV", "Luxury"],
    iconName: "IconPlane", badge: "Fixed Fare", active: true, sortOrder: 5,
  },
  {
    slug: "railway", name: "Railway Transfer",
    tagline: "Station pickup & drop", description: "Station pickups and drops timed to your arrival. We monitor train schedules so you never miss a connection.",
    category: "ride", formType: "railway", serviceTab: "local",
    vehicleCategories: ["Sedan", "MUV"],
    iconName: "IconTrain", badge: null, active: true, sortOrder: 6,
  },
  {
    slug: "nationwide", name: "Nationwide Pickup",
    tagline: "Anywhere to your city", description: "Travelling from anywhere in India? We coordinate door-to-door pickup with our network of trusted partner drivers.",
    category: "ride", formType: "outstation", serviceTab: "outstation",
    vehicleCategories: ["Sedan", "MUV", "Luxury"],
    iconName: "IconGlobe", badge: null, active: true, sortOrder: 7,
  },
  {
    slug: "full-day-hire", name: "Full Day Hire",
    tagline: "A cab for the whole day", description: "A dedicated cab for the whole day. Meetings, errands, sightseeing — your driver stays with you.",
    category: "ride", formType: "hire", serviceTab: "local",
    vehicleCategories: ["Sedan", "MUV", "Luxury"],
    iconName: "IconClock", badge: "Flexible", active: true, sortOrder: 8,
  },
  {
    slug: "weekly-commute", name: "Weekly Commute",
    tagline: "Book for the whole week", description: "Book for 5 or 7 days at a flat weekly rate. Perfect for office commuters and regular travellers.",
    category: "ride", formType: "hire", serviceTab: "local",
    vehicleCategories: ["Hatchback", "Sedan", "MUV"],
    iconName: "IconCalendar", badge: "Save 20%", active: true, sortOrder: 9,
  },
  // ── Special Services ───────────────────────────────────────────────────────
  {
    slug: "wedding", name: "Wedding Cars",
    tagline: "Luxury fleet for events", description: "Luxury fleet for weddings and events. Professionally decorated cars and chauffeurs in formals.",
    category: "special", formType: "event", serviceTab: "local",
    vehicleCategories: ["Luxury"],
    iconName: "IconHeart", badge: "Premium", active: true, sortOrder: 10,
  },
  {
    slug: "tempo", name: "Tempo Traveller",
    tagline: "Group travel solutions", description: "Group travel for 10–20 passengers. Ideal for picnics, pilgrimages, and family trips.",
    category: "special", formType: "group", serviceTab: "airport",
    vehicleCategories: ["Traveller"],
    iconName: "IconUsers", badge: null, active: true, sortOrder: 11,
  },
  {
    slug: "corporate", name: "Corporate Plan",
    tagline: "Business transport", description: "Managed billing, GST invoices, and priority support for businesses.",
    category: "special", formType: "inquiry", serviceTab: "local",
    vehicleCategories: [],
    iconName: "IconBriefcase", badge: "For Teams", active: true, sortOrder: 12,
  },
  {
    slug: "tours", name: "Tour Packages",
    tagline: "Explore the region", description: "Curated tours with experienced driver-guides. Customisable itineraries.",
    category: "special", formType: "event", serviceTab: "outstation",
    vehicleCategories: ["Sedan", "MUV", "Luxury", "Traveller"],
    iconName: "IconPalmtree", badge: "Trending", active: true, sortOrder: 13,
  },
  {
    slug: "events", name: "Events",
    tagline: "Logistics support", description: "Logistics and transport support for conferences, weddings, and large events.",
    category: "special", formType: "event", serviceTab: "local",
    vehicleCategories: ["Sedan", "MUV", "Luxury"],
    iconName: "IconCalendarDays", badge: null, active: true, sortOrder: 14,
  },
  {
    slug: "school", name: "School Transport",
    tagline: "Student transport", description: "Safe, GPS-tracked student transport with verified drivers and fixed routes.",
    category: "special", formType: "inquiry", serviceTab: "local",
    vehicleCategories: [],
    iconName: "IconGraduationCap", badge: null, active: true, sortOrder: 15,
  },
] as const;

async function seed() {
  console.log("Seeding services...");
  let created = 0;
  let skipped = 0;

  for (const svc of SEED_SERVICES) {
    const [existing] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.slug, svc.slug))
      .limit(1);

    if (existing) {
      console.log(`  skip  ${svc.slug} (already exists)`);
      skipped++;
      continue;
    }

    await db.insert(services).values({
      id:                nanoid(),
      slug:              svc.slug,
      name:              svc.name,
      tagline:           svc.tagline,
      description:       svc.description,
      category:          svc.category,
      formType:          svc.formType,
      serviceTab:        svc.serviceTab,
      vehicleCategories: [...svc.vehicleCategories],
      iconName:          svc.iconName,
      badge:             svc.badge ?? null,
      active:            svc.active,
      sortOrder:         svc.sortOrder,
    });

    console.log(`  ✓     ${svc.slug}`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
