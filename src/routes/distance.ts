import Elysia, { t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { logger } from "@/lib/logging";

export const distanceRouter = new Elysia({ prefix: "/distance" })
  .use(rateLimit({ max: 60, duration: 60_000 }))
  .get(
  "/",
  async ({ query }) => {
    const { pickupLat, pickupLng, dropLat, dropLng } = query;
    const apiKey = process.env.OLA_MAPS_API_KEY;

    if (!apiKey) return { success: false, distanceKm: null };

    const url =
      `https://api.olamaps.io/routing/v1/distanceMatrix` +
      `?origins=${pickupLat},${pickupLng}&destinations=${dropLat},${dropLng}` +
      `&api_key=${apiKey}`;

    try {
      const res  = await fetch(url, {
        headers: { "X-Request-Id": crypto.randomUUID() },
      });
      const data = await res.json() as any;
      logger.debug({ module: "distance", response: data }, "Ola Maps response");
      const meters: number | undefined = data.rows?.[0]?.elements?.[0]?.distance;
      if (meters == null) return { success: false, distanceKm: null };
      const distanceKm = Math.round((meters / 1000) * 10) / 10;
      return { success: true, distanceKm };
    } catch (err) {
      logger.error({ module: "distance", error: err }, "Ola Maps fetch error");
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
