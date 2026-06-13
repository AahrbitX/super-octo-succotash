import Elysia, { t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { logger } from "@/lib/logging";

const OLA_BASE = "https://api.olamaps.io/places/v1";

function olaHeaders() {
  return { "X-Request-Id": crypto.randomUUID() };
}

// ── Simple TTL cache ──────────────────────────────────────────────────────────
// autocomplete: 60 s  (search terms repeat while user types)
// geocode:     300 s  (addresses don't change)
// reverse:     300 s  (same pin dragged to nearby spot returns same address)

interface CacheEntry { data: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Router ────────────────────────────────────────────────────────────────────

export const placesRouter = new Elysia({ prefix: "/places" })
  .use(rateLimit({
    max: 120,
    duration: 60_000,
    generator: (req, server) =>
      server?.requestIP(req)?.address ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown",
  }))

  // ── Autocomplete ─────────────────────────────────────────────────────────────
  .get(
    "/autocomplete",
    async ({ query }) => {
      const apiKey = process.env.OLA_MAPS_API_KEY;
      if (!apiKey) {
        logger.error("[autocomplete] OLA_MAPS_API_KEY not set");
        return Response.json({ predictions: [] }, { status: 503 });
      }

      const cacheKey = `ac:${query.input.toLowerCase()}`;
      const cached   = cacheGet(cacheKey);
      if (cached) return cached;

      const url  = `${OLA_BASE}/autocomplete?input=${encodeURIComponent(query.input)}&api_key=${apiKey}`;
      const res  = await fetch(url, { headers: olaHeaders() });
      const data = await res.json();
      if (!res.ok) logger.warn({ status: res.status, input: query.input }, "[autocomplete] upstream error");
      cacheSet(cacheKey, data, 60_000);
      return data;
    },
    {
      query: t.Object({ input: t.String() }),
      detail: { tags: ["Places"], description: "Autocomplete suggestions (proxied)" },
    },
  )

  // ── Geocode ───────────────────────────────────────────────────────────────────
  .get(
    "/geocode",
    async ({ query }) => {
      const apiKey = process.env.OLA_MAPS_API_KEY;
      if (!apiKey) {
        logger.error("[geocode] OLA_MAPS_API_KEY not set");
        return Response.json({ geocodingResults: [] }, { status: 503 });
      }

      const cacheKey = `geo:${query.address.toLowerCase()}`;
      const cached   = cacheGet(cacheKey);
      if (cached) return cached;

      const url  = `${OLA_BASE}/geocode?address=${encodeURIComponent(query.address)}&api_key=${apiKey}`;
      const res  = await fetch(url, { headers: olaHeaders() });
      const data = await res.json();
      if (!res.ok) logger.warn({ status: res.status, address: query.address }, "[geocode] upstream error");
      cacheSet(cacheKey, data, 300_000);
      return data;
    },
    {
      query: t.Object({ address: t.String() }),
      detail: { tags: ["Places"], description: "Geocode an address string (proxied)" },
    },
  )

  // ── Reverse Geocode ───────────────────────────────────────────────────────────
  .get(
    "/reverse-geocode",
    async ({ query }) => {
      const apiKey = process.env.OLA_MAPS_API_KEY;
      if (!apiKey) {
        logger.error("[reverse-geocode] OLA_MAPS_API_KEY not set");
        return Response.json({ results: [] }, { status: 503 });
      }

      // Round to 4 decimal places (~11 m precision) so nearby drags hit the cache
      const parts    = query.latlng.split(",").map(Number);
      const cacheKey = `rev:${(parts[0] ?? 0).toFixed(4)},${(parts[1] ?? 0).toFixed(4)}`;
      const cached   = cacheGet(cacheKey);
      if (cached) return cached;

      const url  = `${OLA_BASE}/reverse-geocode?latlng=${query.latlng}&api_key=${apiKey}`;
      const res  = await fetch(url, { headers: olaHeaders() });
      const data = await res.json();
      if (!res.ok) logger.warn({ status: res.status, latlng: query.latlng }, "[reverse-geocode] upstream error");
      cacheSet(cacheKey, data, 300_000);
      return data;
    },
    {
      query: t.Object({ latlng: t.String() }),
      detail: { tags: ["Places"], description: "Reverse-geocode lat,lng to address (proxied)" },
    },
  );
