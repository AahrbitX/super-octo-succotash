import { Elysia } from "elysia";
import { auth } from "./lib/auth";
import { cors } from "@elysiajs/cors";

// other Routers
import { bookingsRouter } from "./routes/bookings";
import { placesRouter } from "./routes/places";
import { reviewsRouter } from "./routes/review";
import { usersRouter } from "./routes/users";
import { logger } from "./lib/logging";

const app = new Elysia()
  // For Logging Purpose
  .onRequest(({ request }) => {
    logger.info(
      { method: request.method, url: request.url, requestBody: request.body },
      "Incoming Request",
    );
  })
  .onAfterResponse(({ request, set, responseValue }) => {
    logger.info(
      {
        url: request.url,
        status: set.status,
        responseBody: responseValue,
      },
      "Response Sent",
    );
  })

  // CORS middleware to allow requests from frontend
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    }),
  )

  // Mouting this route to be handled by Better Auth
  .mount("/", auth.handler)

  // Session middleware to attach user session to each request
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return { session };
  })

  // Health check endpoint
  .get("/", () => ({ status: "Mohan Cabs API is running" }))

  // Mouting others routers - Business logic
  .group("/api", (app) =>
    app
      .use(bookingsRouter)
      .use(placesRouter)
      .use(reviewsRouter)
      .use(usersRouter),
  )

  // Listen to 4000 port
  .listen(process.env.PORT || 4000);

export type App = typeof app;

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
