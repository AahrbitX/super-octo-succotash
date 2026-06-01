import Elysia, { t } from "elysia";

export const distanceRouter = new Elysia({ prefix: "/distance" }).get(
  "/",
  async ({ query }) => {
    const { pickupLat, pickupLng, dropLat, dropLng } = query;
    const token = process.env.MAPBOX_TOKEN;

    if (!token) return { success: false, distanceKm: null };

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${pickupLng},${pickupLat};${dropLng},${dropLat}` +
      `?access_token=${token}&overview=false`;

    try {
      const res  = await fetch(url);
      const data = await res.json();
      const meters: number | undefined = data.routes?.[0]?.distance;
      if (meters == null) return { success: false, distanceKm: null };
      const distanceKm = Math.round((meters / 1000) * 10) / 10;
      return { success: true, distanceKm };
    } catch {
      return { success: false, distanceKm: null };
    }
  },
  {
    query: t.Object({
      pickupLat: t.Numeric(),
      pickupLng: t.Numeric(),
      dropLat:   t.Numeric(),
      dropLng:   t.Numeric(),
    }),
    detail: {
      tags: ["Distance"],
      description: "Calculate road distance in km between two coordinates (public)",
    },
  },
);
