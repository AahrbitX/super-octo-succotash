import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  time,
  smallint,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth-schema";

// --- ENUMS ---
export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "sedan",
  "suv",
  "minivan",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "paid",
  "refunded",
  "failed",
]);

// --- 6.2 Table: places ---
export const places = pgTable(
  "places",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 150 }).notNull(),
    zone: varchar("zone", { length: 100 }).notNull(),
    baseFare: numeric("base_fare", { precision: 8, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_places_active").on(table.active)],
);

// --- 6.3 Table: bookings ---
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bookingRef: varchar("booking_ref", { length: 20 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    pickupId: uuid("pickup_id")
      .notNull()
      .references(() => places.id),
    dropId: uuid("drop_id")
      .notNull()
      .references(() => places.id),
    journeyDate: date("journey_date").notNull(),
    journeyTime: time("journey_time").notNull(),
    members: smallint("members").notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    ac: boolean("ac").notNull().default(true),
    totalFare: numeric("total_fare", { precision: 8, scale: 2 }).notNull(),
    status: bookingStatusEnum("status").notNull().default("pending"),
    qrToken: uuid("qr_token")
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`),
    qrExpiresAt: timestamp("qr_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_bookings_user_id").on(table.userId),
    index("idx_bookings_journey_dt").on(table.journeyDate),
    index("idx_bookings_status").on(table.status),
    uniqueIndex("idx_bookings_qr").on(table.qrToken),
    index("idx_bookings_created_at").on(table.createdAt),
  ],
);

// --- 6.4 Table: payments ---
export const payments = pgTable("payments", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  rzpOrderId: varchar("rzp_order_id", { length: 100 }).notNull(),
  rzpPaymentId: varchar("rzp_payment_id", { length: 100 }).unique(),
  amount: numeric("amount", { precision: 8, scale: 2 })
    .notNull()
    .default("500.00"),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  status: paymentStatusEnum("status").notNull().default("created"),
  refundId: varchar("refund_id", { length: 100 }),
  refundedBy: uuid("refunded_by").references(() => user.id),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- 6.5 Table: reviews ---
export const reviews = pgTable("reviews", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id),
  qrToken: uuid("qr_token").notNull(),
  rating: smallint("rating").notNull(),
  comment: text("comment"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- DRIZZLE RELATIONS ---
export const userRelations = relations(user, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingRelations = relations(bookings, ({ one }) => ({
  user: one(user, { fields: [bookings.userId], references: [user.id] }),
  pickup: one(places, { fields: [bookings.pickupId], references: [places.id] }),
  drop: one(places, { fields: [bookings.dropId], references: [places.id] }),
  payment: one(payments, {
    fields: [bookings.id],
    references: [payments.bookingId],
  }),
  review: one(reviews, {
    fields: [bookings.id],
    references: [reviews.bookingId],
  }),
}));
