import Razorpay from "razorpay";
import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { bookings as bookingsTable, payments as paymentsTable } from "@/db/schema";

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const createOrderSchema = {
  body: t.Object({
    bookingId: t.String(),
    amount:    t.Number(),   // ₹ (not paise) — full amount charged now (advance or full)
    mode:      t.Union([t.Literal("full"), t.Literal("partial")]),
  }),
  detail: {
    tags: ["Payments"],
    operationId: "createPaymentOrder",
    description: "Create a Razorpay order for a booking",
  },
};

export const createOrder = async ({
  user,
  set,
  body,
}: {
  user: any;
  set: any;
  body: (typeof createOrderSchema)["body"]["static"];
}) => {
  const { bookingId, amount, mode } = body;

  logger.info({ module: "payments", action: "create-order", bookingId, amount, mode, userId: user.id }, "Creating Razorpay order");

  // Validate booking belongs to this user (or user is admin)
  const [booking] = await db
    .select({ id: bookingsTable.id, userId: bookingsTable.userId, totalFare: bookingsTable.totalFare })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) {
    set.status = 404;
    return { success: false, message: "Booking not found" };
  }

  if (booking.userId !== user.id && user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Forbidden" };
  }

  // Create Razorpay order (amount in paise)
  const order = await rzp.orders.create({
    amount:   Math.round(amount * 100),
    currency: "INR",
    receipt:  bookingId,
  });

  // Single payment record on the booking (outbound for round trips)
  await db.insert(paymentsTable).values({
    bookingId,
    rzpOrderId: order.id,
    amount:     String(amount),
    currency:   "INR",
    mode,
    status:     "created",
  });

  logger.info({ module: "payments", action: "create-order", bookingId, orderId: order.id }, "Razorpay order created");

  set.status = 201;
  return {
    success: true,
    data: {
      orderId:  order.id,
      amount:   order.amount,        // paise
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    },
  };
};
