CREATE TABLE "meal_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"image_url" text NOT NULL,
	"dish_name" text,
	"foods_identified" jsonb DEFAULT '[]'::jsonb,
	"total_calories" numeric,
	"protein_g" numeric,
	"carbs_g" numeric,
	"fat_g" numeric,
	"fiber_g" numeric,
	"confidence" numeric,
	"baseline_portion_pct" numeric,
	"portion_suggestion_pct" numeric,
	"actual_portion_pct" numeric,
	"medication" text,
	"dose_mg" numeric,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_analyses" ADD CONSTRAINT "meal_analyses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;