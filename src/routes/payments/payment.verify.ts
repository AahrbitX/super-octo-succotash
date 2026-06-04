import { createHmac } from "crypto";
import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { sendAdminAlertToAll, getAdminPhones } from "@/lib/whatsapp";
import { bookings as bookingsTable, payments as paymentsTable, places as placesTable } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";

export const verifyPaymentSchema = {
  body: t.Object({
    bookingId:       t.String(),
    rzp_order_id:    t.String(),
    rzp_payment_id:  t.String(),
    rzp_signature:   t.String(),
  }),
  detail: {
    tags: ["Payments"],
    operationId: "verifyPayment",
    description: "Verify Razorpay payment signature and confirm booking",
  },
};

export const verifyPayment = async ({
  user,
  set,
  body,
}: {
  user: any;
  set: any;
  body: (typeof verifyPaymentSchema)["body"]["static"];
}) => {
  const { bookingId, rzp_order_id, rzp_payment_id, rzp_signature } = body;

  logger.info({ module: "payments", action: "verify", bookingId, rzp_order_id }, "Verifying payment signature");

  // 1. Verify HMAC-SHA256 signature
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${rzp_order_id}|${rzp_payment_id}`)
    .digest("hex");

  if (expected !== rzp_signature) {
    logger.warn({ module: "payments", action: "verify", bookingId }, "Signature mismatch");
    set.status = 400;
    return { success: false, message: "Payment verification failed" };
  }

  // 2. Update payment record — one record per Razorpay order
  await db
    .update(paymentsTable)
    .set({
      rzpPaymentId: rzp_payment_id,
      status:       "paid",
      paidAt:       new Date(),
    })
    .where(eq(paymentsTable.rzpOrderId, rzp_order_id));

  // 3. Update booking status — confirm outbound (and linked return leg for round trips)
  const [currentBooking] = await db
    .select({ status: bookingsTable.status, linkedBookingId: bookingsTable.linkedBookingId })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (currentBooking && currentBooking.status !== "ongoing" && currentBooking.status !== "completed" && currentBooking.status !== "cancelled") {
    await db
      .update(bookingsTable)
      .set({ status: "confirmed" })
      .where(eq(bookingsTable.id, bookingId));
    logger.info({ module: "payments", action: "verify", bookingId }, "Payment verified, booking confirmed");
  }

  // For round trips also confirm the return leg
  if (currentBooking?.linkedBookingId) {
    const [returnBooking] = await db
      .select({ status: bookingsTable.status })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, currentBooking.linkedBookingId))
      .limit(1);

    if (returnBooking && returnBooking.status !== "ongoing" && returnBooking.status !== "completed" && returnBooking.status !== "cancelled") {
      await db
        .update(bookingsTable)
        .set({ status: "confirmed" })
        .where(eq(bookingsTable.id, currentBooking.linkedBookingId));
      logger.info({ module: "payments", action: "verify", linkedBookingId: currentBooking.linkedBookingId }, "Return leg confirmed");
    }
  }

  // 4. Notify all admins — replace console.log with WhatsApp when ready
  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace   = alias(placesTable, "drop_place");

  const [booking] = await db
    .select({
      bookingRef:   bookingsTable.bookingRef,
      customerName: bookingsTable.customerName,
      customerPhone: bookingsTable.customerPhone,
      journeyDate:  bookingsTable.journeyDate,
      journeyTime:  bookingsTable.journeyTime,
      totalFare:    bookingsTable.totalFare,
      vehicleType:  bookingsTable.vehicleType,
      ac:           bookingsTable.ac,
      members:      bookingsTable.members,
      pickupName:   pickupPlace.name,
      dropName:     dropPlace.name,
    })
    .from(bookingsTable)
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace,   eq(bookingsTable.dropId,   dropPlace.id))
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (booking) {
    const adminPhones = getAdminPhones();

    await sendAdminAlertToAll(adminPhones, {
      eventType: "New Booking Confirmed",
      bookingRef: booking.bookingRef,
      details: `${booking.customerName} | ${booking.journeyDate} ${booking.journeyTime} | ${booking.pickupName} → ${booking.dropName} | ₹${booking.totalFare}`,
    }).catch((err) =>
      logger.warn({ module: "whatsapp", action: "adminAlertPayment", bookingId, err }, "WhatsApp send failed")
    );
  }

  return { success: true, message: "Payment verified and booking confirmed" };
};
