// src/routes/services/services.list.ts
import { db } from "@/db";
import { services, serviceLocations } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export const servicesList = async () => {
  const rows = await db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.name));

  const locationRows = await db
    .select()
    .from(serviceLocations)
    .orderBy(asc(serviceLocations.sortOrder));

  // Group locations by serviceId
  const locationsByService: Record<string, typeof locationRows> = {};
  for (const loc of locationRows) {
    if (!locationsByService[loc.serviceId]) locationsByService[loc.serviceId] = [];
    locationsByService[loc.serviceId].push(loc);
  }

  const data = rows.map((svc) => ({
    ...svc,
    locations: locationsByService[svc.id] ?? [],
  }));

  return { success: true, data };
};

export const servicesGet = async ({ params, set }: { params: { slug: string }; set: any }) => {
  const [svc] = await db
    .select()
    .from(services)
    .where(eq(services.slug, params.slug))
    .limit(1);

  if (!svc) {
    set.status = 404;
    return { success: false, message: "Service not found" };
  }

  const locations = await db
    .select()
    .from(serviceLocations)
    .where(eq(serviceLocations.serviceId, svc.id))
    .orderBy(asc(serviceLocations.sortOrder));

  return { success: true, data: { ...svc, locations } };
};
