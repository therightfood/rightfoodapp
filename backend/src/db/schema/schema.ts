import { pgTable, text, timestamp, boolean, numeric, integer } from 'drizzle-orm/pg-core';
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
