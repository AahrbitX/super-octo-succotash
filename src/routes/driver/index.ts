import Elysia from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings as bookingsTable, payments as paymentsTable, places as placesTable } from "@/db/schema";
import { logger } from "@/lib/logging";
import { driverVerifyPayment, driverVerifyPaymentSchema } from "./driver.verify-payment";
import { driverEndRide, driverEndRideSchema } from "./driver.end-ride";

const pickupPlace = alias(placesTable, "pickup_place");
const dropPlace = alias(placesTable, "drop_place");

export const driverRouter = new Elysia({ prefix: "/driver" })
  .use(rateLimit({ max: 30, duration: 60_000 }))

  /** GET /api/driver/:token — public, returns ride details for the driver */
  .get("/:token", async ({ params, set }) => {
    try {
    const rows = await db
      .select({
        id: bookingsTable.id,
        bookingRef: bookingsTable.bookingRef,
        status: bookingsTable.status,
        customerName: bookingsTable.customerName,
        customerPhone: bookingsTable.customerPhone,
        journeyDate: bookingsTable.journeyDate,
        journeyTime: bookingsTable.journeyTime,
        totalFare: bookingsTable.totalFare,
        vehicleType: bookingsTable.vehicleType,
        ac: bookingsTable.ac,
        members: bookingsTable.members,
        pickupName: pickupPlace.name,
        dropName: dropPlace.name,
      })
      .from(bookingsTable)
      .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
      .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))
      .where(eq(bookingsTable.qrToken, params.token))
      .limit(1);

    if (!rows[0]) {
      set.status = 404;
      return { success: false, message: "Ride not found" };
    }

    const b = rows[0];

    // Query 1: sum of all paid amounts
    const [sumRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${paymentsTable.amount}::numeric), 0)::text` })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.bookingId, b.id),
        inArray(paymentsTable.status, ["paid", "cash_collected"]),
      ));

    // Query 2: active cash_pending payment waiting for OTP
    const [cashPendingRow] = await db
      .select({
        id:            paymentsTable.id,
        amount:        paymentsTable.amount,
        paymentMethod: paymentsTable.paymentMethod,
      })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.bookingId, b.id),
        eq(paymentsTable.status, "cash_pending"),
      ))
      .limit(1);

    const totalPaid  = parseFloat(sumRow?.total ?? "0");
    const totalFare  = parseFloat(b.totalFare ?? "0");
    const balanceDue = Math.max(0, totalFare - totalPaid);
    const cashPending = cashPendingRow
      ? {
          paymentId:     cashPendingRow.id,
          paymentAmount: cashPendingRow.amount,
          paymentMethod: cashPendingRow.paymentMethod,
        }
      : null;

    return {
      success: true,
      data: {
        id: b.id,
        bookingRef: b.bookingRef,
        status: b.status,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        journeyDate: b.journeyDate,
        journeyTime: b.journeyTime,
        totalFare: b.totalFare,
        vehicleType: b.vehicleType,
        ac: b.ac,
        members: b.members,
        pickupName: b.pickupName ?? "—",
        dropName: b.dropName ?? "—",
        // Calculated from DB payment aggregation
        totalPaid:    totalPaid.toFixed(2),
        balanceDue:   balanceDue.toFixed(2),
        // Active cash payment (driver needs to enter OTP for this)
        paymentId:     cashPending?.paymentId     ?? null,
        paymentStatus: cashPending ? "cash_pending" : null,
        paymentAmount: cashPending?.paymentAmount ?? null,
        paymentMethod: cashPending?.paymentMethod ?? null,
      },
    };
    } catch (error: any) {
      logger.error({ module: "driver", action: "get_ride", token: params.token, error: error.message, cause: error.cause?.message, detail: error.detail }, "Failed to fetch ride details");
      set.status = 500;
      return { success: false, message: "Failed to load ride details" };
    }
  })

  /** PATCH /api/driver/:token/start — public, driver starts the ride */
  .patch("/:token/start", async ({ params, set }) => {
    const rows = await db
      .select({ id: bookingsTable.id, status: bookingsTable.status, bookingRef: bookingsTable.bookingRef })
      .from(bookingsTable)
      .where(eq(bookingsTable.qrToken, params.token))
      .limit(1);

    if (!rows[0]) {
      set.status = 404;
      return { success: false, message: "Ride not found" };
    }

    if (rows[0].status !== "confirmed") {
      set.status = 400;
      return {
        success: false,
        message:
          rows[0].status === "ongoing"
            ? "Ride already started"
            : `Ride cannot be started — status is "${rows[0].status}"`,
      };
    }

    await db
      .update(bookingsTable)
      .set({ status: "ongoing", rideStartedAt: new Date(), updatedAt: new Date() })
      .where(eq(bookingsTable.id, rows[0].id));

    logger.info(
      { module: "driver", action: "start_ride", bookingId: rows[0].id, bookingRef: rows[0].bookingRef },
      "Ride started by driver",
    );

    return { success: true, message: "Ride started" };
  })

  /** POST /api/driver/:token/verify-payment — driver enters customer's OTP to confirm cash */
  .post("/:token/verify-payment", ({ params, body, set }) =>
    driverVerifyPayment({ params, body, set }),
    { body: driverVerifyPaymentSchema.body }
  )

  /** PATCH /api/driver/:token/end — driver ends the ride */
  .patch("/:token/end", ({ params, set }) =>
    driverEndRide({ params, set }),
  );
