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
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth-schema";

// --- ENUMS ---
export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "hatchback",
  "sedan",
  "suv",
  "minivan",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "ongoing",
  "completed",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "paid",
  "cash_pending",
  "cash_collected",
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
  (table) => [
    index("idx_places_active").on(table.active),
    index("idx_places_name").on(table.name),
  ],
);

// --- Table: bookings ---
export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    bookingRef: varchar("booking_ref", { length: 20 }).notNull().unique(),
    userId: text("user_id").references(() => user.id),
    bookedByUserId: text("booked_by_user_id")
      .notNull()
      .references(() => user.id),
    customerName: varchar("customer_name", { length: 150 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    source: varchar("source", { length: 20 }).notNull().default("admin"),
    serviceType: varchar("service_type", { length: 20 }).notNull().default("local"), // 'local' | 'outstation' | 'airport'
    notes: text("notes"),
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
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
    }),
    rideStartedAt: timestamp("ride_started_at", {
      withTimezone: true,
    }),
    rideEndedAt: timestamp("ride_ended_at", {
      withTimezone: true,
    }),
    tripType: varchar("trip_type", { length: 10 }).notNull().default("oneway"),  // 'oneway' | 'roundtrip'
    legType:  varchar("leg_type",  { length: 10 }).notNull().default("single"),  // 'single' | 'outbound' | 'return'
    linkedBookingId: text("linked_booking_id"),  // ID of the other leg in a round trip

    qrToken: uuid("qr_token")
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`),
    qrExpiresAt: timestamp("qr_expires_at", {
      withTimezone: true,
    }).notNull().default(sql`NOW() + INTERVAL '7 days'`),
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
  },
  (table) => [
    index("idx_bookings_journey_driver").on(table.journeyDate, table.driverId, table.status),
    index("idx_bookings_created_at").on(table.createdAt),
    index("idx_bookings_user_id").on(table.userId),
    index("idx_bookings_status").on(table.status),
    index("idx_bookings_booking_ref").on(table.bookingRef),
    index("idx_bookings_pickup_id").on(table.pickupId),
    index("idx_bookings_drop_id").on(table.dropId),
    index("idx_bookings_driver_id").on(table.driverId),
  ],
);

// --- Table: payments ---
export const payments = pgTable(
  "payments",
  {
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
    paymentMethod: varchar("payment_method", { length: 10 }).notNull().default("online"),
    cashCode: varchar("cash_code", { length: 10 }),
    cashVerifiedAt: timestamp("cash_verified_at", { withTimezone: true }),
    adminVerifiedBy: text("admin_verified_by").references(() => user.id),
    adminVerifiedAt: timestamp("admin_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_payments_booking_balance").on(table.bookingId).where(sql`mode = 'balance'`),
    index("idx_payments_booking_id").on(table.bookingId),
    index("idx_payments_created_at").on(table.createdAt),
    index("idx_payments_status").on(table.status),
  ],
);

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
  flagged: boolean("flagged").default(false).notNull(),
  unread: boolean("unread").default(true).notNull(),
  ratingPunctuality: smallint("rating_punctuality"),
  ratingCleanliness: smallint("rating_cleanliness"),
  ratingBehavior:    smallint("rating_behavior"),
  ratingDriving:     smallint("rating_driving"),
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
    collectionCode: varchar("collection_code", { length: 10 }).unique(),
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
    index("idx_drivers_vehicle_number").on(table.vehicleNumber),
    index("idx_drivers_created_at").on(table.createdAt),
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
    index("idx_driver_locations_driver_id").on(table.driverId),
  ],
);

// --- Table: support_tickets ---
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const ticketCategoryEnum = pgEnum("ticket_category", [
  "payment",
  "driver_issue",
  "route_issue",
  "other",
]);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    bookingId: text("booking_id").references(() => bookings.id),
    category: ticketCategoryEnum("category").notNull().default("other"),
    subject: varchar("subject", { length: 200 }).notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_support_tickets_user").on(table.userId, table.createdAt),
    index("idx_support_tickets_booking").on(table.bookingId),
  ],
);

// --- Table: fleet_vehicles ---
export const fleetVehicles = pgTable(
  "fleet_vehicles",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    tagline: varchar("tagline", { length: 200 }),
    category: varchar("category", { length: 50 }).notNull(), // Hatchback | Sedan | MUV | Luxury | Traveller
    image: text("image"),
    seats: smallint("seats").notNull().default(4),
    bags: smallint("bags").notNull().default(2),
    ac: boolean("ac").notNull().default(true),
    fuel: varchar("fuel", { length: 50 }).notNull().default("Petrol"),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    priceFrom: varchar("price_from", { length: 30 }),
    active: boolean("active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_fleet_vehicles_active").on(table.active, table.sortOrder),
    index("idx_fleet_vehicles_category").on(table.category),
  ],
);

// --- Table: vehicle_pricing ---
export const vehiclePricing = pgTable(
  "vehicle_pricing",
  {
    id: text("id").primaryKey(),
    vehicleType: varchar("vehicle_type", { length: 100 }).notNull().unique(),
    defaultAmount: numeric("default_amount", { precision: 8, scale: 2 }).notNull().default("0"),
    defaultUnit: varchar("default_unit", { length: 30 }).notNull().default("per km"),
    serviceFares: jsonb("service_fares").$type<Record<string, { amount: number; unit: string }>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
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
