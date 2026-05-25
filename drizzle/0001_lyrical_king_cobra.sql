ALTER TYPE "public"."payment_status" ADD VALUE 'cash_pending' BEFORE 'refunded';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'cash_collected' BEFORE 'refunded';--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "collection_code" varchar(10);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_method" varchar(10) DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cash_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "admin_verified_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "admin_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_admin_verified_by_user_id_fk" FOREIGN KEY ("admin_verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_collection_code_unique" UNIQUE("collection_code");
