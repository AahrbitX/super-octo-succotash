// src/routes/public-pay.ts
// Public payment page endpoints — no auth required (accessed via booking qrToken)
import Elysia, { t } from "elysia";
import Razorpay from "razorpay";
import { rateLimit } from "elysia-rate-limit";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import crypto from "crypto";

import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable, places as placesTable } from "@/db/schema";

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const publicPayRouter = new Elysia({ prefix: "/pay" })
  .use(rateLimit({ max: 30, duration: 60_000 }))

  /**
   * GET /api/pay/:token
   * Returns booking + payment summary for the public payment page.
   */
  .get("/:token", async ({ params, set }) => {
    const pickupPlace = alias(placesTable, "pickup_place");
    const dropPlace   = alias(placesTable, "drop_place");

    const [booking] = await db
      .select({
        id:           bookingsTable.id,
        bookingRef:   bookingsTable.bookingRef,
        status:       bookingsTable.status,
        customerName: bookingsTable.customerName,
        totalFare:    bookingsTable.totalFare,
        journeyDate:  bookingsTable.journeyDate,
        journeyTime:  bookingsTable.journeyTime,
        pickupName:   pickupPlace.name,
        dropName:     dropPlace.name,
      })
      .from(bookingsTable)
      .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
      .leftJoin(dropPlace,   eq(bookingsTable.dropId,   dropPlace.id))
      .where(eq(bookingsTable.qrToken, params.token))
      .limit(1);

    if (!booking) {
      set.status = 404;
      return { success: false, message: "Booking not found" };
    }

    if (!["pending", "confirmed", "ongoing"].includes(booking.status)) {
      set.status = 400;
      return { success: false, message: "This booking does not have a pending payment" };
    }

    // Calculate amount already paid
    const [sumRow] = await db
      .select({ paid: sql<string>`COALESCE(SUM(${paymentsTable.amount}::numeric), 0)::text` })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.bookingId, booking.id),
          inArray(paymentsTable.status, ["paid", "cash_collected"]),
        ),
      );

    const totalFare = parseFloat(booking.totalFare ?? "0");
    const totalPaid = parseFloat(sumRow?.paid ?? "0");
    const amountDue = Math.max(0, totalFare - totalPaid);

    if (amountDue <= 0) {
      set.status = 400;
      return { success: false, message: "No outstanding payment for this booking" };
    }

    return {
      success: true,
      data: {
        bookingRef:   booking.bookingRef,
        customerName: booking.customerName,
        journeyDate:  booking.journeyDate,
        journeyTime:  booking.journeyTime,
        pickupName:   booking.pickupName ?? "—",
        dropName:     booking.dropName   ?? "—",
        totalFare:    totalFare.toFixed(2),
        totalPaid:    totalPaid.toFixed(2),
        amountDue:    amountDue.toFixed(2),
        keyId:        process.env.RAZORPAY_KEY_ID,
      },
    };
  })

  /**
   * POST /api/pay/:token/order
   * Creates a Razorpay order for the balance due (public, validated by qrToken).
   */
  .post(
    "/:token/order",
    async ({ params, set }) => {
      const [booking] = await db
        .select({
          id:        bookingsTable.id,
          bookingRef: bookingsTable.bookingRef,
          status:    bookingsTable.status,
          totalFare: bookingsTable.totalFare,
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.qrToken, params.token))
        .limit(1);

      if (!booking) {
        set.status = 404;
        return { success: false, message: "Booking not found" };
      }

      if (!["pending", "confirmed", "ongoing"].includes(booking.status)) {
        set.status = 400;
        return { success: false, message: "Cannot create payment for this booking" };
      }

      const [sumRow] = await db
        .select({ paid: sql<string>`COALESCE(SUM(${paymentsTable.amount}::numeric), 0)::text` })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.bookingId, booking.id),
            inArray(paymentsTable.status, ["paid", "cash_collected"]),
          ),
        );

      const totalFare = parseFloat(booking.totalFare ?? "0");
      const totalPaid = parseFloat(sumRow?.paid ?? "0");
      const amountDue = Math.max(0, totalFare - totalPaid);

      if (amountDue <= 0) {
        set.status = 400;
        return { success: false, message: "No outstanding payment for this booking" };
      }

      const order = await rzp.orders.create({
        amount:   Math.round(amountDue * 100),
        currency: "INR",
        receipt:  booking.id,
      });

      const mode = totalPaid > 0 ? "balance" : "full";

      await db.insert(paymentsTable).values({
        bookingId:  booking.id,
        rzpOrderId: order.id,
        amount:     String(amountDue),
        currency:   "INR",
        mode,
        status:     "created",
      });

      logger.info({ module: "public-pay", action: "create_order", bookingId: booking.id, orderId: order.id }, "Public payment order created");

      set.status = 201;
      return {
        success: true,
        data: {
          orderId:  order.id,
          amount:   order.amount,
          currency: order.currency,
          keyId:    process.env.RAZORPAY_KEY_ID,
        },
      };
    },
  )

  /**
   * POST /api/pay/:token/verify
   * Verify Razorpay signature and mark payment as paid (public).
   */
  .post(
    "/:token/verify",
    async ({ params, body, set }) => {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(`${body.orderId}|${body.paymentId}`)
        .digest("hex");

      if (expectedSignature !== body.signature) {
        set.status = 400;
        return { success: false, message: "Payment verification failed" };
      }

      const [payment] = await db
        .update(paymentsTable)
        .set({ status: "paid", rzpPaymentId: body.paymentId, paidAt: new Date() })
        .where(eq(paymentsTable.rzpOrderId, body.orderId))
        .returning({ id: paymentsTable.id, bookingId: paymentsTable.bookingId });

      if (!payment) {
        set.status = 404;
        return { success: false, message: "Payment record not found" };
      }

      logger.info({ module: "public-pay", action: "verify", paymentId: body.paymentId }, "Public payment verified");

      set.status = 200;
      return { success: true, message: "Payment verified successfully" };
    },
    {
      body: t.Object({
        orderId:   t.String(),
        paymentId: t.String(),
        signature: t.String(),
      }),
    },
  );
