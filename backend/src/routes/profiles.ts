import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

interface ProfileResponse {
  id: string;
  user_id: string;
  disclaimer_acknowledged: boolean;
  medication: string | null;
  dose_mg: string | null;
  weight_kg: string | null;
  height_cm: string | null;
  age: number | null;
  gender: string | null;
  country: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface UpdateProfileBody {
  disclaimer_acknowledged?: boolean;
  medication?: string | null;
  dose_mg?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  gender?: string | null;
  country?: string | null;
  onboarding_completed?: boolean;
}

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/profile - Get current user's profile
  app.fastify.get('/api/profile', {
    schema: {
      description: 'Get current user profile',
      tags: ['profiles'],
      response: {
        200: {
          description: 'User profile',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            disclaimer_acknowledged: { type: 'boolean' },
            medication: { type: ['string', 'null'] },
            dose_mg: { type: ['string', 'null'] },
            weight_kg: { type: ['string', 'null'] },
            height_cm: { type: ['string', 'null'] },
            age: { type: ['integer', 'null'] },
            gender: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            onboarding_completed: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<ProfileResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user profile');

    const profile = await app.db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.id, userId),
    });

    if (profile) {
      app.logger.info({ userId }, 'Profile found');
      return {
        id: profile.id,
        user_id: profile.userId,
        disclaimer_acknowledged: profile.disclaimerAcknowledged,
        medication: profile.medication || null,
        dose_mg: profile.doseMg ? profile.doseMg.toString() : null,
        weight_kg: profile.weightKg ? profile.weightKg.toString() : null,
        height_cm: profile.heightCm ? profile.heightCm.toString() : null,
        age: profile.age,
        gender: profile.gender || null,
        country: profile.country || null,
        onboarding_completed: profile.onboardingCompleted,
        created_at: profile.createdAt.toISOString(),
        updated_at: profile.updatedAt.toISOString(),
      };
    }

    // Return default profile without creating a row
    app.logger.info({ userId }, 'No profile found, returning default');
    const now = new Date().toISOString();
    return {
      id: userId,
      user_id: userId,
      disclaimer_acknowledged: false,
      medication: null,
      dose_mg: null,
      weight_kg: null,
      height_cm: null,
      age: null,
      gender: null,
      country: null,
      onboarding_completed: false,
      created_at: now,
      updated_at: now,
    };
  });

  // PUT /api/profile - Create or update user profile
  app.fastify.put('/api/profile', {
    schema: {
      description: 'Create or update user profile',
      tags: ['profiles'],
      body: {
        type: 'object',
        properties: {
          disclaimer_acknowledged: { type: 'boolean' },
          medication: { type: ['string', 'null'] },
          dose_mg: { type: ['number', 'null'] },
          weight_kg: { type: ['number', 'null'] },
          height_cm: { type: ['number', 'null'] },
          age: { type: ['integer', 'null'] },
          gender: { type: ['string', 'null'] },
          country: { type: ['string', 'null'] },
          onboarding_completed: { type: 'boolean' },
        },
      },
      response: {
        200: {
          description: 'Updated profile',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            disclaimer_acknowledged: { type: 'boolean' },
            medication: { type: ['string', 'null'] },
            dose_mg: { type: ['string', 'null'] },
            weight_kg: { type: ['string', 'null'] },
            height_cm: { type: ['string', 'null'] },
            age: { type: ['integer', 'null'] },
            gender: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            onboarding_completed: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: UpdateProfileBody }>,
    reply: FastifyReply
  ): Promise<ProfileResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const body = request.body;

    app.logger.info({ userId, body }, 'Upserting user profile');

    // Fetch current profile to check if medication or dose changed
    const currentProfile = await app.db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, userId),
    });

    // Build the update data from provided fields
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.disclaimer_acknowledged !== undefined) {
      updateData.disclaimerAcknowledged = body.disclaimer_acknowledged;
    }
    if (body.medication !== undefined) {
      updateData.medication = body.medication;
    }
    if (body.dose_mg !== undefined) {
      updateData.doseMg = body.dose_mg !== null ? body.dose_mg.toString() : null;
    }
    if (body.weight_kg !== undefined) {
      updateData.weightKg = body.weight_kg !== null ? body.weight_kg.toString() : null;
    }
    if (body.height_cm !== undefined) {
      updateData.heightCm = body.height_cm !== null ? body.height_cm.toString() : null;
    }
    if (body.age !== undefined) {
      updateData.age = body.age;
    }
    if (body.gender !== undefined) {
      updateData.gender = body.gender;
    }
    if (body.country !== undefined) {
      updateData.country = body.country;
    }
    if (body.onboarding_completed !== undefined) {
      updateData.onboardingCompleted = body.onboarding_completed;
    }

    // Check if medication or dose changed
    const medicationChanged = body.medication !== undefined && body.medication !== currentProfile?.medication;
    const doseChanged = body.dose_mg !== undefined && body.dose_mg !== (currentProfile?.doseMg ? Number(currentProfile.doseMg) : null);

    if (medicationChanged || doseChanged) {
      updateData.doseChangedAt = new Date();
      app.logger.info({ userId }, 'Dose or medication changed, setting dose_changed_at');
    }

    // Upsert the profile
    const [upsertedProfile] = await app.db
      .insert(schema.userProfiles)
      .values({
        id: userId,
        userId: userId,
        disclaimerAcknowledged: body.disclaimer_acknowledged ?? false,
        medication: body.medication ?? null,
        doseMg: body.dose_mg !== undefined ? (body.dose_mg !== null ? body.dose_mg.toString() : null) : null,
        weightKg: body.weight_kg !== undefined ? (body.weight_kg !== null ? body.weight_kg.toString() : null) : null,
        heightCm: body.height_cm !== undefined ? (body.height_cm !== null ? body.height_cm.toString() : null) : null,
        age: body.age ?? null,
        gender: body.gender ?? null,
        country: body.country ?? null,
        onboardingCompleted: body.onboarding_completed ?? false,
      })
      .onConflictDoUpdate({
        target: schema.userProfiles.id,
        set: updateData,
      })
      .returning();

    app.logger.info({ userId }, 'Profile upserted successfully');

    return {
      id: upsertedProfile.id,
      user_id: upsertedProfile.userId,
      disclaimer_acknowledged: upsertedProfile.disclaimerAcknowledged,
      medication: upsertedProfile.medication || null,
      dose_mg: upsertedProfile.doseMg ? upsertedProfile.doseMg.toString() : null,
      weight_kg: upsertedProfile.weightKg ? upsertedProfile.weightKg.toString() : null,
      height_cm: upsertedProfile.heightCm ? upsertedProfile.heightCm.toString() : null,
      age: upsertedProfile.age,
      gender: upsertedProfile.gender || null,
      country: upsertedProfile.country || null,
      onboarding_completed: upsertedProfile.onboardingCompleted,
      created_at: upsertedProfile.createdAt.toISOString(),
      updated_at: upsertedProfile.updatedAt.toISOString(),
    };
  });

  // GET /api/profile/stats - Get user stats
  app.fastify.get('/api/profile/stats', {
    schema: {
      description: 'Get user statistics',
      tags: ['profiles'],
      response: {
        200: {
          description: 'User statistics',
          type: 'object',
          properties: {
            total_meals_scanned: { type: 'integer' },
            days_using_app: { type: 'integer' },
            current_streak: { type: 'integer' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<{ total_meals_scanned: number; days_using_app: number; current_streak: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user stats');

    // Get total meals scanned
    const mealAnalyses = await app.db.query.mealAnalyses.findMany({
      where: (table, { and, eq }) =>
        and(eq(table.userId, userId), eq(table.status, 'completed')),
    });
    const totalMealsScanned = mealAnalyses.length;

    // Get days using app
    let daysUsingApp = 1;
    try {
      const users = await app.db.select().from(authSchema.user).where(eq(authSchema.user.id, userId));
      if (users.length > 0) {
        const authUser = users[0];
        const createdDate = typeof authUser.createdAt === 'string' ? new Date(authUser.createdAt) : authUser.createdAt;
        daysUsingApp = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } catch (err) {
      app.logger.warn({ userId, err }, 'Failed to get user creation date, defaulting to 1 day');
    }

    // Get current streak - consecutive days going backwards from today
    let currentStreak = 0;
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    for (let daysBack = 0; daysBack < 365; daysBack++) {
      const dayStart = new Date(todayStart.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayMeals = await app.db.query.mealAnalyses.findMany({
        where: (table, { and, eq: eqOp, isNotNull, gte, lt }) =>
          and(
            eqOp(table.userId, userId),
            isNotNull(table.actualPortionPct),
            eqOp(table.status, 'completed'),
            gte(table.createdAt, dayStart),
            lt(table.createdAt, dayEnd)
          ),
      });

      if (dayMeals.length > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    app.logger.info({ userId, totalMealsScanned, daysUsingApp, currentStreak }, 'User stats calculated');

    return {
      total_meals_scanned: totalMealsScanned,
      days_using_app: daysUsingApp,
      current_streak: currentStreak,
    };
  });

  // PUT /api/profile/reminders - Update reminder settings
  app.fastify.put('/api/profile/reminders', {
    schema: {
      description: 'Update reminder settings',
      tags: ['profiles'],
      body: {
        type: 'object',
        required: ['reminder_enabled', 'reminder_times'],
        properties: {
          reminder_enabled: { type: 'boolean' },
          reminder_times: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 3,
          },
          timezone: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Reminders updated',
          type: 'object',
          properties: {
            reminder_enabled: { type: 'boolean' },
            reminder_times: { type: 'array', items: { type: 'string' } },
            timezone: { type: 'string' },
          },
        },
        400: {
          description: 'Invalid reminder_times format',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { reminder_enabled: boolean; reminder_times: string[]; timezone?: string } }>,
    reply: FastifyReply
  ): Promise<{ reminder_enabled: boolean; reminder_times: string[]; timezone: string } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { reminder_enabled, reminder_times, timezone } = request.body;

    app.logger.info({ userId, reminder_enabled, reminder_times, timezone }, 'Updating reminders');

    // Validate reminder_times format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!Array.isArray(reminder_times) || reminder_times.length > 3 || !reminder_times.every(time => timeRegex.test(time))) {
      app.logger.warn({ userId, reminder_times }, 'Invalid reminder_times format');
      return reply.status(400).send({ error: 'Invalid reminder_times format' });
    }

    // Fetch current profile to get existing timezone if not provided
    const currentProfile = await app.db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, userId),
    });

    const updateData: any = {
      reminderEnabled: reminder_enabled,
      reminderTimes: reminder_times,
      updatedAt: new Date(),
    };

    if (timezone) {
      updateData.timezone = timezone;
    }

    // Upsert user_profiles
    const [updated] = await app.db
      .insert(schema.userProfiles)
      .values({
        id: userId,
        userId: userId,
        reminderEnabled: reminder_enabled,
        reminderTimes: reminder_times,
        timezone: timezone || 'UTC',
      })
      .onConflictDoUpdate({
        target: schema.userProfiles.id,
        set: updateData,
      })
      .returning();

    app.logger.info({ userId }, 'Reminders updated successfully');

    return {
      reminder_enabled,
      reminder_times,
      timezone: updated.timezone,
    };
  });

  // PUT /api/profile/onesignal-id - Update OneSignal ID
  app.fastify.put('/api/profile/onesignal-id', {
    schema: {
      description: 'Update OneSignal ID for push notifications',
      tags: ['profiles'],
      body: {
        type: 'object',
        required: ['onesignal_id'],
        properties: {
          onesignal_id: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'OneSignal ID updated',
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { onesignal_id: string } }>,
    reply: FastifyReply
  ): Promise<{ ok: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { onesignal_id } = request.body;

    app.logger.info({ userId, onesignal_id }, 'Updating OneSignal ID');

    await app.db
      .insert(schema.userProfiles)
      .values({
        id: userId,
        userId: userId,
        onesignalId: onesignal_id,
      })
      .onConflictDoUpdate({
        target: schema.userProfiles.id,
        set: {
          onesignalId: onesignal_id,
          updatedAt: new Date(),
        },
      })
      .returning();

    app.logger.info({ userId }, 'OneSignal ID updated successfully');

    return { ok: true };
  });

  // DELETE /api/account - Delete user account and all data
  app.fastify.delete('/api/account', {
    schema: {
      description: 'Delete user account and all associated data',
      tags: ['profiles'],
      response: {
        200: {
          description: 'Account deleted successfully',
          type: 'object',
          properties: {
            deleted: { type: 'boolean' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          description: 'Failed to delete account',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<{ deleted: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Starting account deletion');

    try {
      // Delete in specific order
      // 1. Delete meal_analyses
      await app.db.delete(schema.mealAnalyses).where(eq(schema.mealAnalyses.userId, userId));
      app.logger.info({ userId }, 'Deleted meal analyses');

      // 2. Delete menu_sessions
      await app.db.delete(schema.menuSessions).where(eq(schema.menuSessions.userId, userId));
      app.logger.info({ userId }, 'Deleted menu sessions');

      // 3. Delete recipe_sessions
      await app.db.delete(schema.recipeSessions).where(eq(schema.recipeSessions.userId, userId));
      app.logger.info({ userId }, 'Deleted recipe sessions');

      // 4. Delete user_profiles
      await app.db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
      app.logger.info({ userId }, 'Deleted user profile');

      // 5. Delete user auth data (sessions, accounts, verifications, user)
      // Delete auth-related tables manually since Better Auth manages these
      try {
        // Delete sessions
        await app.db.delete(authSchema.session).where(eq(authSchema.session.userId, userId));
        app.logger.info({ userId }, 'Deleted sessions');
      } catch (err) {
        app.logger.warn({ userId, err }, 'Failed to delete sessions');
      }

      try {
        // Delete accounts
        await app.db.delete(authSchema.account).where(eq(authSchema.account.userId, userId));
        app.logger.info({ userId }, 'Deleted accounts');
      } catch (err) {
        app.logger.warn({ userId, err }, 'Failed to delete accounts');
      }

      try {
        // Delete verification
        await app.db.delete(authSchema.verification).where(eq(authSchema.verification.identifier, userId));
        app.logger.info({ userId }, 'Deleted verification');
      } catch (err) {
        app.logger.warn({ userId, err }, 'Failed to delete verification');
      }

      try {
        // Delete user
        await app.db.delete(authSchema.user).where(eq(authSchema.user.id, userId));
        app.logger.info({ userId }, 'Deleted user');
      } catch (err) {
        app.logger.warn({ userId, err }, 'Failed to delete user');
      }

      app.logger.info({ userId }, 'Account deletion completed successfully');

      return { deleted: true };
    } catch (err) {
      app.logger.error({ userId, err }, 'Failed to delete account');
      return reply.status(500).send({
        error: 'Failed to delete account. Please contact support.',
      });
    }
  });
}
