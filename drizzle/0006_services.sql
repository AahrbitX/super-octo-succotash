CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(100) NOT NULL,
	"tagline" varchar(200) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" varchar(20) DEFAULT 'ride' NOT NULL,
	"form_type" varchar(20) DEFAULT 'standard' NOT NULL,
	"service_tab" varchar(20) DEFAULT 'local' NOT NULL,
	"vehicle_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"icon_name" varchar(60) DEFAULT 'IconCar' NOT NULL,
	"badge" varchar(60),
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "service_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"location_type" varchar(10) DEFAULT 'both' NOT NULL,
	"name" varchar(150) NOT NULL,
	"sublabel" varchar(100),
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "service_slug" varchar(60);
--> statement-breakpoint
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_services_active" ON "services" USING btree ("active","sort_order");
--> statement-breakpoint
CREATE INDEX "idx_services_slug" ON "services" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "idx_service_locations_service" ON "service_locations" USING btree ("service_id","sort_order");
