import { Elysia } from "elysia";
import { auth } from "./lib/auth";
import { cors } from "@elysiajs/cors";
import { logger } from "./lib/logging";
import { openapi, fromTypes } from "@elysia/openapi";

// other Routers
import { bookingsRouter } from "./routes/bookings/index";
import { driverRouter } from "./routes/driver";
import { placesRouter } from "./routes/places";
import { reviewsRouter } from "./routes/reviews";
import { usersRouter } from "./routes/users";
import { driversRouter } from "./routes/drivers";
import { dispatchersRouter } from "./routes/dispatchers";
import { reportsRouter } from "./routes/reports";
import { paymentsRouter } from "./routes/payments";
import { ticketsRouter } from "./routes/tickets";
import { fleetRouter } from "./routes/fleet";
import { pricingRouter } from "./routes/pricing";
import { vehiclesRouter } from "./routes/vehicles";
import { distanceRouter } from "./routes/distance";
import { publicReviewRouter } from "./routes/public-review";
import { publicPayRouter } from "./routes/public-pay";

const app = new Elysia()

  // API documentation with openAPI plugin
  .use(
    openapi({
      references: fromTypes(),
      documentation: {
        info: {
          title: "Cab Booking Service API",
          version: "0.1",
          description: "Cab booking and Admin management system",
        },
      },
    }),
  )

  // For Logging Purpose
  .onRequest(({ request, store }) => {
    (store as any)._reqStart = Date.now();
  })
  .onAfterResponse(({ request, set, store }) => {
    const duration = Date.now() - ((store as any)._reqStart ?? Date.now());
    const path = new URL(request.url).pathname;
    logger.info(
      { method: request.method, path, status: set.status, duration },
      "request",
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

  // Health check endpoint
  .get("/", () => ({ status: "Mohan Cabs API is running" }), {
    detail: {
      tags: ["Basic"],
      description: "Status check / Health Check endpoint",
    },
  })

  // Mouting others routers - Business logic
  .group("/api", (app) =>
    app
      .use(bookingsRouter)
      .use(driverRouter)
      .use(dispatchersRouter)
      .use(placesRouter)
      .use(reviewsRouter)
      .use(usersRouter)
      .use(driversRouter)
      .use(reportsRouter)
      .use(paymentsRouter)
      .use(ticketsRouter)
      .use(fleetRouter)
      .use(pricingRouter)
      .use(vehiclesRouter)
      .use(distanceRouter)
      .use(publicReviewRouter)
      .use(publicPayRouter),
  )

  // Listen to 4000 port
  .listen(process.env.PORT || 4000);

export type App = typeof app;

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
