ALTER TABLE "user_profiles" ADD COLUMN "dose_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "reminder_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "reminder_times" jsonb DEFAULT '[]'::jsonb;