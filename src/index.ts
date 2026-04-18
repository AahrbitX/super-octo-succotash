import { Elysia } from "elysia";
import { auth } from "./lib/auth";
import { cors } from "@elysiajs/cors";

// other Routers
import { bookingsRouter } from "./routes/bookings";
import { placesRouter } from "./routes/places";
import { reviewsRouter } from "./routes/review";

const app = new Elysia()
  // CORS middleware to allow requests from frontend
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    }),
  )

  // Mount Better Auth middleware at /api/auth
  .mount("/api/auth", auth.handler)

  // Session middleware to attach user session to each request
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return { session };
  })

  // Health check endpoint
  .get("/", () => ({ status: "Mohan Cabs API is running" }))

  // Mouting others routers
  .group("/api", (app) =>
    app.use(bookingsRouter).use(placesRouter).use(reviewsRouter),
  )

  // Listen to 4000 port
  .listen(process.env.PORT || 4000);

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
