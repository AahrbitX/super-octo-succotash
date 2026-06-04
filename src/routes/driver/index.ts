import Elysia from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { desc, eq } from "drizzle-orm";
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

    // Fetch ALL payment records for this booking to calculate real balance
    const allPayments = await db
      .select({
        paymentId:     paymentsTable.id,
        paymentStatus: paymentsTable.status,
        paymentAmount: paymentsTable.amount,
        paymentMethod: paymentsTable.paymentMethod,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.bookingId, b.id))
      .orderBy(desc(paymentsTable.createdAt));

    // Sum all completed payments (paid online or cash collected)
    const totalPaid = allPayments
      .filter(p => p.paymentStatus === "paid" || p.paymentStatus === "cash_collected")
      .reduce((sum, p) => sum + parseFloat(p.paymentAmount ?? "0"), 0);

    const totalFare = parseFloat(b.totalFare ?? "0");
    const balanceDue = Math.max(0, totalFare - totalPaid);

    // Active cash payment waiting for OTP (most important for driver)
    const cashPending = allPayments.find(p => p.paymentStatus === "cash_pending");

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
        // Calculated from all DB payment records
        totalPaid:    totalPaid.toFixed(2),
        balanceDue:   balanceDue.toFixed(2),
        // Active cash payment (driver needs to enter OTP for this)
        paymentId:     cashPending?.paymentId     ?? null,
        paymentStatus: cashPending ? "cash_pending" : null,
        paymentAmount: cashPending?.paymentAmount ?? null,
        paymentMethod: cashPending?.paymentMethod ?? null,
      },
    };
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
