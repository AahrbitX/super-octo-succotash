import { t } from "elysia";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import {
  bookings as bookingsTable,
  payments as paymentsTable,
  places as placesTable,
} from "@/db/schema";

export const adminPaymentDetailSchema = {
  params: t.Object({ id: t.String() }),
  detail: {
    tags: ["Payments"],
    operationId: "adminGetPayment",
    description: "Admin: get full details of a single transaction",
  },
};

export const adminPaymentDetail = async ({
  user,
  params,
  set,
}: {
  user: any;
  params: { id: string };
  set: any;
}) => {
  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Admin access required", data: null };
  }

  const pickupPlace = alias(placesTable, "pickup_place");
  const dropPlace   = alias(placesTable, "drop_place");

  const [row] = await db
    .select({
      id: paymentsTable.id,
      bookingId: paymentsTable.bookingId,
      rzpOrderId: paymentsTable.rzpOrderId,
      rzpPaymentId: paymentsTable.rzpPaymentId,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      mode: paymentsTable.mode,
      paymentMethod: paymentsTable.paymentMethod,
      paidAt: paymentsTable.paidAt,
      cashVerifiedAt: paymentsTable.cashVerifiedAt,
      adminVerifiedBy: paymentsTable.adminVerifiedBy,
      adminVerifiedAt: paymentsTable.adminVerifiedAt,
      createdAt: paymentsTable.createdAt,
      bookingRef: bookingsTable.bookingRef,
      journeyDate: bookingsTable.journeyDate,
      journeyTime: bookingsTable.journeyTime,
      totalFare: bookingsTable.totalFare,
      bookingStatus: bookingsTable.status,
      members: bookingsTable.members,
      vehicleType: bookingsTable.vehicleType,
      userName: bookingsTable.customerName,
      userPhone: bookingsTable.customerPhone,
      pickupName: pickupPlace.name,
      dropName: dropPlace.name,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .leftJoin(pickupPlace, eq(bookingsTable.pickupId, pickupPlace.id))
    .leftJoin(dropPlace, eq(bookingsTable.dropId, dropPlace.id))
    .where(eq(paymentsTable.id, params.id))
    .limit(1);

  if (!row) {
    set.status = 404;
    return { success: false, message: "Transaction not found", data: null };
  }

  logger.info({ module: "payments", action: "admin-detail", paymentId: params.id }, "Admin fetched transaction detail");

  set.status = 200;
  return { success: true, data: row };
};
