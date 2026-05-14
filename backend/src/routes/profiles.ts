import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

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
}
