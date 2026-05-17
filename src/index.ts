import { Elysia } from "elysia";
import { auth } from "./lib/auth";
import { cors } from "@elysiajs/cors";
import { logger } from "./lib/logging";
import { openapi, fromTypes } from "@elysia/openapi";

// other Routers
import { bookingsRouter } from "./routes/bookings/index";
import { placesRouter } from "./routes/places";
import { reviewsRouter } from "./routes/review";
import { usersRouter } from "./routes/users";
import { driversRouter } from "./routes/drivers";
import { dispatchersRouter } from "./routes/dispatchers";
import { reportsRouter } from "./routes/reports";
import { otpVerify, otpVerifySchema } from "./routes/users/users.otp-verify";
import { otpComplete, otpCompleteSchema } from "./routes/users/users.onboarding";

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
  .get("/", () => ({ status: "Mohan Cabs API is running" }), {
    detail: {
      tags: ["Basic"],
      description: "Status check / Health Check endpoint",
    },
  })

  // Mouting others routers - Business logic
  .group("/api", (app) =>
    app
      .post("/auth/otp-verify", otpVerify, otpVerifySchema)
      .post("/auth/otp-complete", otpComplete, otpCompleteSchema)
      .use(bookingsRouter)
      .use(dispatchersRouter)
      .use(placesRouter)
      .use(reviewsRouter)
      .use(usersRouter)
      .use(driversRouter)
      .use(reportsRouter),
  )

  // Listen to 4000 port
  .listen(process.env.PORT || 4000);

export type App = typeof app;

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
