CREATE TYPE "public"."ticket_category" AS ENUM('payment', 'driver_issue', 'route_issue', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
ALTER TYPE "public"."vehicle_type" ADD VALUE 'hatchback' BEFORE 'sedan';--> statement-breakpoint
CREATE TABLE "fleet_vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"tagline" varchar(200),
	"category" varchar(50) NOT NULL,
	"image" text,
	"seats" smallint DEFAULT 4 NOT NULL,
	"bags" smallint DEFAULT 2 NOT NULL,
	"ac" boolean DEFAULT true NOT NULL,
	"fuel" varchar(50) DEFAULT 'Petrol' NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_from" varchar(30),
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"booking_id" text,
	"category" "ticket_category" DEFAULT 'other' NOT NULL,
	"subject" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_pricing" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_type" varchar(100) NOT NULL,
	"default_amount" numeric(8, 2) DEFAULT '0' NOT NULL,
	"default_unit" varchar(30) DEFAULT 'per km' NOT NULL,
	"service_fares" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_pricing_vehicle_type_unique" UNIQUE("vehicle_type")
);
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "qr_expires_at" SET DEFAULT NOW() + INTERVAL '7 days';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "service_type" varchar(20) DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "trip_type" varchar(10) DEFAULT 'oneway' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "leg_type" varchar(10) DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "linked_booking_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ride_start_otp" varchar(6);--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "unread" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "rating_punctuality" smallint;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "rating_cleanliness" smallint;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "rating_behavior" smallint;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "rating_driving" smallint;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "marketing_consent" boolean;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "marketing_consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fleet_vehicles_active" ON "fleet_vehicles" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_fleet_vehicles_category" ON "fleet_vehicles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_user" ON "support_tickets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_booking" ON "support_tickets" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_created_at" ON "bookings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bookings_user_id" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_booking_ref" ON "bookings" USING btree ("booking_ref");--> statement-breakpoint
CREATE INDEX "idx_bookings_pickup_id" ON "bookings" USING btree ("pickup_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_drop_id" ON "bookings" USING btree ("drop_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_driver_id" ON "bookings" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "idx_driver_locations_driver_id" ON "driver_locations" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "idx_drivers_vehicle_number" ON "drivers" USING btree ("vehicle_number");--> statement-breakpoint
CREATE INDEX "idx_drivers_created_at" ON "drivers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payments_booking_balance" ON "payments" USING btree ("booking_id") WHERE mode = 'balance';--> statement-breakpoint
CREATE INDEX "idx_payments_booking_id" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_payments_created_at" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_places_name" ON "places" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_user_name" ON "user" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_user_phone" ON "user" USING btree ("phone_number");