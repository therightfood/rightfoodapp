CREATE TABLE "menu_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"image_url" text NOT NULL,
	"extracted_items" jsonb DEFAULT '[]'::jsonb,
	"recommendations" jsonb DEFAULT '[]'::jsonb,
	"medication" text,
	"dose_mg" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_sessions" ADD CONSTRAINT "menu_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;