import { pgTable, text, timestamp, boolean, numeric, integer, jsonb } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const userProfiles = pgTable('user_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  disclaimerAcknowledged: boolean('disclaimer_acknowledged').notNull().default(false),
  medication: text('medication'),
  doseMg: numeric('dose_mg'),
  weightKg: numeric('weight_kg'),
  heightCm: numeric('height_cm'),
  age: integer('age'),
  gender: text('gender'),
  country: text('country'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const mealAnalyses = pgTable('meal_analyses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  dishName: text('dish_name'),
  foodsIdentified: jsonb('foods_identified').default([]),
  totalCalories: numeric('total_calories'),
  proteinG: numeric('protein_g'),
  carbsG: numeric('carbs_g'),
  fatG: numeric('fat_g'),
  fiberG: numeric('fiber_g'),
  confidence: numeric('confidence'),
  baselinePortionPct: numeric('baseline_portion_pct'),
  portionSuggestionPct: numeric('portion_suggestion_pct'),
  actualPortionPct: numeric('actual_portion_pct'),
  medication: text('medication'),
  doseMg: numeric('dose_mg'),
  timeOfDay: text('time_of_day'),
  calorieDesity: text('calorie_density'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const recipeSessions = pgTable('recipe_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  ingredientsInput: text('ingredients_input').notNull(),
  recipesReturned: jsonb('recipes_returned').default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const menuSessions = pgTable('menu_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  extractedItems: jsonb('extracted_items').default([]),
  recommendations: jsonb('recommendations').default([]),
  medication: text('medication'),
  doseMg: numeric('dose_mg'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
