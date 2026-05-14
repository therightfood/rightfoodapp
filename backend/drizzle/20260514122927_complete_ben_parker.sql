ALTER TABLE "user_profiles" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "onesignal_id" text;