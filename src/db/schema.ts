import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
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

// --- Table: places ---
export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    zone: varchar("zone", { length: 100 }).notNull(),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    baseFare: numeric("base_fare", { precision: 8, scale: 2 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_places_active").on(table.active)],
);

// --- Table: bookings ---
export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  bookingRef: varchar("booking_ref", { length: 20 }).notNull().unique(),
  userId: text("user_id").references(() => user.id),
  bookedByUserId: text("booked_by_user_id")
    .notNull()
    .references(() => user.id),
  customerName: varchar("customer_name", { length: 150 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  source: varchar("source", { length: 20 }).notNull().default("admin"),
  driverId: text("driver_id").references(() => drivers.id),
  pickupId: text("pickup_id")
    .notNull()
    .references(() => places.id),
  dropId: text("drop_id")
    .notNull()
    .references(() => places.id),
  journeyDate: date("journey_date").notNull(),
  journeyTime: time("journey_time").notNull(),
  members: smallint("members").notNull(),
  vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
  ac: boolean("ac").notNull().default(true),
  totalFare: numeric("total_fare", {
    precision: 8,
    scale: 2,
  }).notNull(),
  status: bookingStatusEnum("status").notNull().default("pending"),
  rideStartedAt: timestamp("ride_started_at", {
    withTimezone: true,
  }),
  rideEndedAt: timestamp("ride_ended_at", {
    withTimezone: true,
  }),
  qrToken: uuid("qr_token")
    .notNull()
    .unique()
    .default(sql`gen_random_uuid()`),
  qrExpiresAt: timestamp("qr_expires_at", {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

// --- Table: payments ---
export const payments = pgTable("payments", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookings.id),
  rzpOrderId: varchar("rzp_order_id", { length: 100 }).notNull(),
  rzpPaymentId: varchar("rzp_payment_id", { length: 100 }).unique(),
  amount: numeric("amount", { precision: 8, scale: 2 })
    .notNull()
    .default("500.00"),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  status: paymentStatusEnum("status").notNull().default("created"),
  mode: varchar("mode", { length: 10 }).notNull().default("full"),
  refundId: varchar("refund_id", { length: 100 }),
  refundedBy: text("refunded_by").references(() => user.id),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Table: reviews ---
export const reviews = pgTable("reviews", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  bookingId: text("booking_id")
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

// -- Table: drivers --
export const drivers = pgTable(
  "drivers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),
    vehicleNumber: varchar("vehicle_number", { length: 20 }).notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    ac: boolean("ac").notNull().default(true),
    isAvailable: boolean("is_available").notNull().default(true),
    currentLat: numeric("current_lat", { precision: 10, scale: 7 }),
    currentLng: numeric("current_lng", { precision: 10, scale: 7 }),
    lastLocationAt: timestamp("last_location_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_drivers_user_id").on(table.userId),
    index("idx_drivers_available").on(table.isAvailable),
    index("idx_drivers_vehicle").on(table.vehicleType, table.ac),
  ],
);

// -- TABLE : driverLocations --
export const driverLocations = pgTable(
  "driver_locations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    driverId: text("driver_id")
      .notNull()
      .references(() => drivers.id),
    lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
    lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_driver_locations_booking").on(table.bookingId, table.recordedAt),
  ],
);

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
