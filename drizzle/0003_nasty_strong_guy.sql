ALTER TYPE "public"."booking_status" ADD VALUE 'ongoing' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cash_code" varchar(10);