import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';
import * as schema from '../db/schema/schema.js';

interface AnalyzeBody {
  image_url: string;
}

interface MealAnalysisResponse {
  id: string;
  user_id: string;
  image_url: string;
  dish_name: string | null;
  foods_identified: string[];
  total_calories: string | null;
  protein_g: string | null;
  carbs_g: string | null;
  fat_g: string | null;
  fiber_g: string | null;
  confidence: string | null;
  baseline_portion_pct: string | null;
  portion_suggestion_pct: string | null;
  actual_portion_pct: string | null;
  medication: string | null;
  dose_mg: string | null;
  time_of_day: string | null;
  calorie_density: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ConfirmedMeal {
  actual_portion_pct: string | null;
  portion_suggestion_pct: string | null;
  dose_mg: string | null;
  created_at: Date;
}

interface AnalysesListResponse {
  analyses: MealAnalysisResponse[];
}

interface MealAnalysisWithConfirmedCountResponse extends MealAnalysisResponse {
  confirmed_meal_count: number;
}

const DOSE_TIERS: Record<string, number[]> = {
  ozempic: [0.25, 0.5, 1.0, 2.0],
  wegovy: [0.25, 0.5, 1.0, 1.7, 2.4],
  mounjaro: [2.5, 5.0, 7.5, 10.0, 12.5, 15.0],
  zepbound: [2.5, 5.0, 7.5, 10.0, 12.5, 15.0],
};

function calculateBaselinePortionPct(medication: string | null | undefined, doseMg: number | null | undefined): number {
  if (!medication || !doseMg) {
    return 75;
  }

  const lowerMed = medication.toLowerCase();
  const tiers = DOSE_TIERS[lowerMed];

  if (!tiers) {
    return 75;
  }

  const tierIndex = tiers.findIndex(tier => tier === doseMg);
  if (tierIndex === -1) {
    return 75;
  }

  const reduction = tierIndex * 5;
  const baseline = 75 - reduction;

  return Math.max(35, Math.min(90, baseline));
}

function computePersonalizedPortion(
  baseline: number,
  confirmedMeals: ConfirmedMeal[],
  currentDoseMg: number | null | undefined
): number {
  // Filter eligible meals
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const eligibleMeals = confirmedMeals.filter(meal => {
    if (meal.actual_portion_pct === null || meal.portion_suggestion_pct === null) {
      return false;
    }

    // If dose differs from current, only include last 14 days
    const mealDoseMg = meal.dose_mg ? Number(meal.dose_mg) : null;
    if (currentDoseMg !== mealDoseMg) {
      return meal.created_at >= twoWeeksAgo;
    }

    return true;
  });

  // Need at least 5 meals
  if (eligibleMeals.length < 5) {
    return baseline;
  }

  // Take most recent 60
  const recentMeals = eligibleMeals.slice(0, 60);

  // Compute weighted average ratio with time-decay
  let totalWeight = 0;
  let weightedRatioSum = 0;

  for (const meal of recentMeals) {
    const actualPct = Number(meal.actual_portion_pct);
    const suggestedPct = Number(meal.portion_suggestion_pct);

    if (suggestedPct === 0) continue;

    const ratio = actualPct / suggestedPct;
    const ageDays = (now.getTime() - meal.created_at.getTime()) / (24 * 60 * 60 * 1000);
    const weight = 1 / (1 + ageDays * 0.05);

    weightedRatioSum += ratio * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return baseline;
  }

  const weightedAvgRatio = weightedRatioSum / totalWeight;
  const personalized = baseline * weightedAvgRatio;

  // Clamp between 20 and 100, rounded
  return Math.round(Math.max(20, Math.min(100, personalized)));
}

function formatResponse(row: any): MealAnalysisResponse {
  return {
    id: row.id,
    user_id: row.userId,
    image_url: row.imageUrl,
    dish_name: row.dishName || null,
    foods_identified: Array.isArray(row.foodsIdentified) ? row.foodsIdentified : (row.foodsIdentified || []),
    total_calories: row.totalCalories ? row.totalCalories.toString() : null,
    protein_g: row.proteinG ? row.proteinG.toString() : null,
    carbs_g: row.carbsG ? row.carbsG.toString() : null,
    fat_g: row.fatG ? row.fatG.toString() : null,
    fiber_g: row.fiberG ? row.fiberG.toString() : null,
    confidence: row.confidence ? row.confidence.toString() : null,
    baseline_portion_pct: row.baselinePortionPct ? row.baselinePortionPct.toString() : null,
    portion_suggestion_pct: row.portionSuggestionPct ? row.portionSuggestionPct.toString() : null,
    actual_portion_pct: row.actualPortionPct ? row.actualPortionPct.toString() : null,
    medication: row.medication || null,
    dose_mg: row.doseMg ? row.doseMg.toString() : null,
    time_of_day: row.timeOfDay || null,
    calorie_density: row.calorieDesity || null,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function registerScanRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/scan/upload - Upload meal image
  app.fastify.post('/api/scan/upload', {
    schema: {
      description: 'Upload a meal image',
      tags: ['scan'],
      response: {
        200: {
          description: 'Image uploaded successfully',
          type: 'object',
          properties: {
            image_url: { type: 'string' },
          },
        },
        400: {
          description: 'Bad request',
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
        413: {
          description: 'File too large',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<{ image_url: string } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Uploading meal image');

    const data = await request.file({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit
    if (!data) {
      app.logger.warn({ userId }, 'No file provided');
      return reply.status(400).send({ error: 'No file provided' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      app.logger.warn({ userId, err }, 'File size limit exceeded');
      return reply.status(413).send({ error: 'File too large' });
    }

    // Determine file extension
    let ext = 'jpg';
    if (data.mimetype && data.mimetype.includes('png')) {
      ext = 'png';
    } else if (data.mimetype && data.mimetype.includes('webp')) {
      ext = 'webp';
    } else if (data.mimetype && data.mimetype.includes('gif')) {
      ext = 'gif';
    }

    // Upload to storage
    const key = `meal-images/${userId}/${Date.now()}.${ext}`;
    const uploadedKey = await app.storage.upload(key, buffer);

    // Get signed URL
    const { url } = await app.storage.getSignedUrl(uploadedKey);

    app.logger.info({ userId, key: uploadedKey }, 'Image uploaded successfully');

    return { image_url: url };
  });

  // POST /api/scan/analyze - Analyze meal image with AI
  app.fastify.post('/api/scan/analyze', {
    schema: {
      description: 'Analyze a meal image for nutrition information',
      tags: ['scan'],
      body: {
        type: 'object',
        required: ['image_url'],
        properties: {
          image_url: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Analysis completed successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            image_url: { type: 'string' },
            dish_name: { type: ['string', 'null'] },
            foods_identified: { type: 'array', items: { type: 'string' } },
            total_calories: { type: ['string', 'null'] },
            protein_g: { type: ['string', 'null'] },
            carbs_g: { type: ['string', 'null'] },
            fat_g: { type: ['string', 'null'] },
            fiber_g: { type: ['string', 'null'] },
            confidence: { type: ['string', 'null'] },
            baseline_portion_pct: { type: ['string', 'null'] },
            portion_suggestion_pct: { type: ['string', 'null'] },
            actual_portion_pct: { type: ['string', 'null'] },
            medication: { type: ['string', 'null'] },
            dose_mg: { type: ['string', 'null'] },
            time_of_day: { type: ['string', 'null'] },
            calorie_density: { type: ['string', 'null'] },
            status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            confirmed_meal_count: { type: 'integer' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        422: {
          description: 'Analysis failed - low confidence',
          type: 'object',
          properties: {
            error: { type: 'string' },
            status: { type: 'string' },
            id: { type: 'string' },
            image_url: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: AnalyzeBody }>,
    reply: FastifyReply
  ): Promise<MealAnalysisWithConfirmedCountResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { image_url } = request.body;

    app.logger.info({ userId, image_url }, 'Starting meal analysis');

    // Fetch user profile for medication and dose
    const userProfile = await app.db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, userId),
    });

    const medication = userProfile?.medication;
    const doseMg = userProfile?.doseMg ? Number(userProfile.doseMg) : null;

    // Create pending analysis record
    const now = new Date();
    const [createdAnalysis] = await app.db
      .insert(schema.mealAnalyses)
      .values({
        id: `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        userId,
        imageUrl: image_url,
        status: 'pending',
        medication: medication || null,
        doseMg: doseMg ? doseMg.toString() : null,
      })
      .returning();

    app.logger.info({ analysisId: createdAnalysis.id, userId }, 'Created pending analysis record');

    try {
      // Fetch image and convert to base64
      app.logger.info({ image_url }, 'Fetching image for analysis');
      const imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        app.logger.error({ image_url, status: imageResponse.status }, 'Failed to fetch image');
        await app.db
          .update(schema.mealAnalyses)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(schema.mealAnalyses.id, createdAnalysis.id));

        return reply.status(422).send({
          error: 'image_fetch_failed',
          status: 'failed',
          id: createdAnalysis.id,
          image_url,
        });
      }

      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(imageArrayBuffer);
      const base64Image = imageBuffer.toString('base64');

      app.logger.info({ analysisId: createdAnalysis.id }, 'Analyzing image with AI');

      // Call Gemini 2.0 Flash for analysis
      const { text: responseText } = await generateText({
        model: gateway('google/gemini-2.5-flash'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: base64Image },
              {
                type: 'text',
                text: 'Analyze this meal photo. Return JSON only with these fields: dish_name (string), foods_identified (array of strings), total_calories (number, estimate for the full portion shown), protein_g (number), carbs_g (number), fat_g (number), fiber_g (number), confidence (number 0-1 indicating how confident you are in the analysis). Be generous with the calorie estimate — this is for the full plate as shown, not a standard serving. If the image is not food, return confidence: 0. Return ONLY valid JSON, no markdown, no explanation.',
              },
            ],
          },
        ],
        temperature: 0.1,
      });

      app.logger.info({ analysisId: createdAnalysis.id }, 'AI response received, parsing JSON');

      // Parse AI response
      let analysisData: any;
      try {
        analysisData = JSON.parse(responseText);
      } catch (parseErr) {
        app.logger.error({ analysisId: createdAnalysis.id, err: parseErr, response: responseText }, 'Failed to parse AI response');
        // Update to failed status
        await app.db
          .update(schema.mealAnalyses)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(schema.mealAnalyses.id, createdAnalysis.id));

        return reply.status(422).send({
          error: 'analysis_failed',
          status: 'failed',
          id: createdAnalysis.id,
          image_url,
        });
      }

      // Check confidence
      const confidence = Number(analysisData.confidence || 0);
      if (confidence < 0.4) {
        app.logger.warn({ analysisId: createdAnalysis.id, confidence }, 'Low confidence analysis');
        // Update to failed status
        await app.db
          .update(schema.mealAnalyses)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(schema.mealAnalyses.id, createdAnalysis.id));

        return reply.status(422).send({
          error: 'low_confidence',
          status: 'failed',
          id: createdAnalysis.id,
          image_url,
        });
      }

      // Calculate baseline portion percentage
      const baselinePortionPct = calculateBaselinePortionPct(medication, doseMg);

      // Compute time_of_day from current server time
      const now = new Date();
      const hour = now.getHours();
      let timeOfDay = 'night';
      if (hour >= 5 && hour < 11) {
        timeOfDay = 'morning';
      } else if (hour >= 11 && hour < 17) {
        timeOfDay = 'afternoon';
      } else if (hour >= 17 && hour < 22) {
        timeOfDay = 'evening';
      }

      // Compute calorie_density from total_calories
      const totalCalories = Number(analysisData.total_calories || 0);
      let calorieDesity = 'low';
      if (totalCalories > 600) {
        calorieDesity = 'high';
      } else if (totalCalories >= 300) {
        calorieDesity = 'medium';
      }

      // Fetch confirmed meals for personalization
      const confirmedMeals = await app.db.query.mealAnalyses.findMany({
        where: (table, { and, eq, isNotNull }) =>
          and(
            eq(table.userId, userId),
            isNotNull(table.actualPortionPct),
            eq(table.status, 'completed')
          ),
        orderBy: (table, { desc }) => desc(table.createdAt),
        limit: 60,
      });

      // Format confirmed meals for personalization function
      const confirmedMealsData: ConfirmedMeal[] = confirmedMeals.map(meal => ({
        actual_portion_pct: meal.actualPortionPct ? meal.actualPortionPct.toString() : null,
        portion_suggestion_pct: meal.portionSuggestionPct ? meal.portionSuggestionPct.toString() : null,
        dose_mg: meal.doseMg ? meal.doseMg.toString() : null,
        created_at: meal.createdAt,
      }));

      // Count total confirmed meals
      const confirmedMealCount = await app.db.query.mealAnalyses.findMany({
        where: (table, { and, eq, isNotNull }) =>
          and(
            eq(table.userId, userId),
            isNotNull(table.actualPortionPct),
            eq(table.status, 'completed')
          ),
      });

      // Compute personalized portion
      const personalizedPortionPct = computePersonalizedPortion(
        baselinePortionPct,
        confirmedMealsData,
        doseMg
      );

      // Update analysis with results
      const [updatedAnalysis] = await app.db
        .update(schema.mealAnalyses)
        .set({
          dishName: analysisData.dish_name || null,
          foodsIdentified: analysisData.foods_identified || [],
          totalCalories: analysisData.total_calories ? analysisData.total_calories.toString() : null,
          proteinG: analysisData.protein_g ? analysisData.protein_g.toString() : null,
          carbsG: analysisData.carbs_g ? analysisData.carbs_g.toString() : null,
          fatG: analysisData.fat_g ? analysisData.fat_g.toString() : null,
          fiberG: analysisData.fiber_g ? analysisData.fiber_g.toString() : null,
          confidence: confidence.toString(),
          baselinePortionPct: baselinePortionPct.toString(),
          portionSuggestionPct: personalizedPortionPct.toString(),
          timeOfDay,
          calorieDesity,
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(schema.mealAnalyses.id, createdAnalysis.id))
        .returning();

      app.logger.info({ analysisId: updatedAnalysis.id, userId }, 'Analysis completed successfully');

      // Return response with confirmed meal count
      const response = formatResponse(updatedAnalysis);
      return {
        ...response,
        confirmed_meal_count: confirmedMealCount.length,
      };
    } catch (err) {
      app.logger.error({ analysisId: createdAnalysis.id, userId, err }, 'Error during meal analysis');

      // Update to failed status
      try {
        await app.db
          .update(schema.mealAnalyses)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(schema.mealAnalyses.id, createdAnalysis.id));
      } catch (updateErr) {
        app.logger.error({ err: updateErr }, 'Failed to update analysis status');
      }

      return reply.status(422).send({
        error: 'analysis_failed',
        status: 'failed',
        id: createdAnalysis.id,
        image_url,
      });
    }
  });

  // GET /api/scan/analyses - Get user's meal analyses
  app.fastify.get('/api/scan/analyses', {
    schema: {
      description: 'Get all meal analyses for current user',
      tags: ['scan'],
      response: {
        200: {
          description: 'List of meal analyses',
          type: 'object',
          properties: {
            analyses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  image_url: { type: 'string' },
                  dish_name: { type: ['string', 'null'] },
                  foods_identified: { type: 'array', items: { type: 'string' } },
                  total_calories: { type: ['string', 'null'] },
                  protein_g: { type: ['string', 'null'] },
                  carbs_g: { type: ['string', 'null'] },
                  fat_g: { type: ['string', 'null'] },
                  fiber_g: { type: ['string', 'null'] },
                  confidence: { type: ['string', 'null'] },
                  baseline_portion_pct: { type: ['string', 'null'] },
                  portion_suggestion_pct: { type: ['string', 'null'] },
                  actual_portion_pct: { type: ['string', 'null'] },
                  medication: { type: ['string', 'null'] },
                  dose_mg: { type: ['string', 'null'] },
                  time_of_day: { type: ['string', 'null'] },
                  calorie_density: { type: ['string', 'null'] },
                  status: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                },
              },
            },
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
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<AnalysesListResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching meal analyses');

    const analyses = await app.db.query.mealAnalyses.findMany({
      where: eq(schema.mealAnalyses.userId, userId),
      orderBy: (analyses, { desc }) => desc(analyses.createdAt),
      limit: 50,
    });

    app.logger.info({ userId, count: analyses.length }, 'Fetched meal analyses');

    return {
      analyses: analyses.map(formatResponse),
    };
  });

  // PATCH /api/scan/analyses/:id - Update actual portion eaten
  app.fastify.patch('/api/scan/analyses/:id', {
    schema: {
      description: 'Update the actual portion eaten for a meal analysis',
      tags: ['scan'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Analysis ID' },
        },
      },
      body: {
        type: 'object',
        required: ['actual_portion_pct'],
        properties: {
          actual_portion_pct: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      response: {
        200: {
          description: 'Analysis updated successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            actual_portion_pct: { type: 'string' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          description: 'Invalid request - actual_portion_pct must be a number between 0 and 100',
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
        404: {
          description: 'Analysis not found or belongs to a different user',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: { actual_portion_pct: number } }>,
    reply: FastifyReply
  ): Promise<{ id: string; actual_portion_pct: string; updated_at: string } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params;
    const { actual_portion_pct } = request.body;

    app.logger.info({ userId, id, actual_portion_pct }, 'Updating meal analysis portion');

    // Validate actual_portion_pct
    if (typeof actual_portion_pct !== 'number' || actual_portion_pct < 0 || actual_portion_pct > 100) {
      app.logger.warn({ userId, id, actual_portion_pct }, 'Invalid actual_portion_pct value');
      return reply.status(400).send({
        error: 'actual_portion_pct must be a number between 0 and 100',
      });
    }

    // Find the analysis record
    const analysis = await app.db.query.mealAnalyses.findFirst({
      where: eq(schema.mealAnalyses.id, id),
    });

    if (!analysis) {
      app.logger.warn({ userId, id }, 'Analysis not found');
      return reply.status(404).send({
        error: 'Analysis not found',
      });
    }

    // Verify user ownership
    if (analysis.userId !== userId) {
      app.logger.warn({ userId, id, analysisUserId: analysis.userId }, 'Analysis belongs to different user');
      return reply.status(404).send({
        error: 'Analysis not found',
      });
    }

    // Update the analysis
    const [updatedAnalysis] = await app.db
      .update(schema.mealAnalyses)
      .set({
        actualPortionPct: actual_portion_pct.toString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.mealAnalyses.id, id))
      .returning();

    app.logger.info({ userId, id, actual_portion_pct }, 'Meal analysis portion updated successfully');

    return {
      id: updatedAnalysis.id,
      actual_portion_pct: updatedAnalysis.actualPortionPct ? updatedAnalysis.actualPortionPct.toString() : '',
      updated_at: updatedAnalysis.updatedAt.toISOString(),
    };
  });

  // PATCH /api/scan/analyses/:id/share - Mark meal as shared
  app.fastify.patch('/api/scan/analyses/:id/share', {
    schema: {
      description: 'Mark a meal analysis as shared',
      tags: ['scan'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Analysis ID' },
        },
      },
      response: {
        200: {
          description: 'Analysis marked as shared successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            shared_at: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          description: 'Analysis not found or belongs to a different user',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ id: string; shared_at: string | null } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params;

    app.logger.info({ userId, id }, 'Marking meal analysis as shared');

    // Find the analysis record
    const analysis = await app.db.query.mealAnalyses.findFirst({
      where: eq(schema.mealAnalyses.id, id),
    });

    if (!analysis) {
      app.logger.warn({ userId, id }, 'Analysis not found');
      return reply.status(404).send({
        error: 'Not found',
      });
    }

    // Verify user ownership
    if (analysis.userId !== userId) {
      app.logger.warn({ userId, id, analysisUserId: analysis.userId }, 'Analysis belongs to different user');
      return reply.status(404).send({
        error: 'Not found',
      });
    }

    // Update the analysis with shared_at timestamp
    const [updatedAnalysis] = await app.db
      .update(schema.mealAnalyses)
      .set({
        sharedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.mealAnalyses.id, id))
      .returning();

    app.logger.info({ userId, id }, 'Meal analysis marked as shared successfully');

    return {
      id: updatedAnalysis.id,
      shared_at: updatedAnalysis.sharedAt ? updatedAnalysis.sharedAt.toISOString() : null,
    };
  });

  // GET /api/journey - Get meal journey analytics
  app.fastify.get('/api/journey', {
    schema: {
      description: 'Get meal journey analytics and summary stats',
      tags: ['journey'],
      response: {
        200: {
          description: 'Meal journey data',
          type: 'object',
          properties: {
            summary: {
              type: 'object',
              properties: {
                today_calories: { type: 'integer' },
                today_protein_g: { type: 'integer' },
                today_meal_count: { type: 'integer' },
                week_avg_daily_calories: { type: 'integer' },
                week_avg_daily_protein_g: { type: 'integer' },
                week_meal_count: { type: 'integer' },
              },
            },
            meals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  image_url: { type: 'string' },
                  dish_name: { type: ['string', 'null'] },
                  created_at: { type: 'string', format: 'date-time' },
                  effective_portion_pct: { type: 'integer' },
                  effective_calories: { type: 'integer' },
                  effective_protein_g: { type: 'integer' },
                  portion_suggestion_pct: { type: ['string', 'null'] },
                  actual_portion_pct: { type: ['string', 'null'] },
                  total_calories: { type: ['string', 'null'] },
                  protein_g: { type: ['string', 'null'] },
                  carbs_g: { type: ['string', 'null'] },
                  fat_g: { type: ['string', 'null'] },
                  fiber_g: { type: ['string', 'null'] },
                  confidence: { type: ['string', 'null'] },
                  foods_identified: { type: 'array', items: { type: 'string' } },
                  medication: { type: ['string', 'null'] },
                  dose_mg: { type: ['string', 'null'] },
                  time_of_day: { type: ['string', 'null'] },
                  status: { type: 'string' },
                  shared_at: { type: ['string', 'null'], format: 'date-time' },
                },
              },
            },
            daily_breakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  calories: { type: 'integer' },
                  meal_count: { type: 'integer' },
                },
              },
            },
            week_macros: {
              type: 'object',
              properties: {
                avg_daily_calories: { type: 'integer' },
                avg_daily_protein_g: { type: 'integer' },
                avg_daily_carbs_g: { type: 'integer' },
                avg_daily_fat_g: { type: 'integer' },
              },
            },
            tdee: {
              type: 'object',
              properties: {
                calorie_target: { type: 'integer' },
                protein_target: { type: 'integer' },
              },
            },
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
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<any | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching meal journey');

    // Fetch all completed meals for this user, limit 200
    const meals = await app.db.query.mealAnalyses.findMany({
      where: (table, { and, eq }) =>
        and(eq(table.userId, userId), eq(table.status, 'completed')),
      orderBy: (table, { desc }) => desc(table.createdAt),
      limit: 200,
    });

    app.logger.info({ userId, mealCount: meals.length }, 'Fetched meals for journey');

    // Get today's date in UTC
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Get week start (7 days ago)
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Helper function to calculate effective portion
    const getEffectivePortion = (meal: any): number => {
      if (meal.actualPortionPct !== null) {
        return Number(meal.actualPortionPct);
      }
      if (meal.portionSuggestionPct !== null) {
        return Number(meal.portionSuggestionPct);
      }
      return 100;
    };

    // Helper function to calculate effective calories
    const calculateEffectiveCalories = (meal: any, effectivePortion: number): number => {
      const totalCals = Number(meal.totalCalories || 0);
      return Math.round(totalCals * effectivePortion / 100);
    };

    // Helper function to calculate effective protein
    const calculateEffectiveProtein = (meal: any, effectivePortion: number): number => {
      const protein = Number(meal.proteinG || 0);
      return Math.round(protein * effectivePortion / 100);
    };

    // Helper function to calculate effective carbs
    const calculateEffectiveCarbs = (meal: any, effectivePortion: number): number => {
      const carbs = Number(meal.carbsG || 0);
      return Math.round(carbs * effectivePortion / 100);
    };

    // Helper function to calculate effective fat
    const calculateEffectiveFat = (meal: any, effectivePortion: number): number => {
      const fat = Number(meal.fatG || 0);
      return Math.round(fat * effectivePortion / 100);
    };

    // Process meals and calculate stats
    let todayCalories = 0;
    let todayProtein = 0;
    let todayMealCount = 0;
    let weekCalories = 0;
    let weekProtein = 0;
    let weekCarbs = 0;
    let weekFat = 0;
    let weekMealCount = 0;

    const processedMeals = meals.map(meal => {
      const effectivePortion = getEffectivePortion(meal);
      const effectiveCalories = calculateEffectiveCalories(meal, effectivePortion);
      const effectiveProtein = calculateEffectiveProtein(meal, effectivePortion);
      const effectiveCarbs = calculateEffectiveCarbs(meal, effectivePortion);
      const effectiveFat = calculateEffectiveFat(meal, effectivePortion);

      // Check if meal is from today
      if (meal.createdAt >= todayStart && meal.createdAt < todayEnd) {
        todayCalories += effectiveCalories;
        todayProtein += effectiveProtein;
        todayMealCount++;
      }

      // Check if meal is from this week
      if (meal.createdAt >= weekStart) {
        weekCalories += effectiveCalories;
        weekProtein += effectiveProtein;
        weekCarbs += effectiveCarbs;
        weekFat += effectiveFat;
        weekMealCount++;
      }

      return {
        id: meal.id,
        image_url: meal.imageUrl,
        dish_name: meal.dishName || null,
        created_at: meal.createdAt.toISOString(),
        effective_portion_pct: Math.round(effectivePortion),
        effective_calories: effectiveCalories,
        effective_protein_g: effectiveProtein,
        portion_suggestion_pct: meal.portionSuggestionPct ? meal.portionSuggestionPct.toString() : null,
        actual_portion_pct: meal.actualPortionPct ? meal.actualPortionPct.toString() : null,
        total_calories: meal.totalCalories ? meal.totalCalories.toString() : null,
        protein_g: meal.proteinG ? meal.proteinG.toString() : null,
        carbs_g: meal.carbsG ? meal.carbsG.toString() : null,
        fat_g: meal.fatG ? meal.fatG.toString() : null,
        fiber_g: meal.fiberG ? meal.fiberG.toString() : null,
        confidence: meal.confidence ? meal.confidence.toString() : null,
        foods_identified: Array.isArray(meal.foodsIdentified)
          ? meal.foodsIdentified
          : meal.foodsIdentified || [],
        medication: meal.medication || null,
        dose_mg: meal.doseMg ? meal.doseMg.toString() : null,
        time_of_day: meal.timeOfDay || null,
        status: meal.status,
        shared_at: meal.sharedAt ? meal.sharedAt.toISOString() : null,
      };
    });

    // Calculate week averages for macros
    const weekAvgDailyCalories = Math.round(weekCalories / 7);
    const weekAvgDailyProtein = Math.round(weekProtein / 7);
    const weekAvgDailyCarbs = Math.round(weekCarbs / 7);
    const weekAvgDailyFat = Math.round(weekFat / 7);

    // Calculate daily breakdown for last 7 days
    const dailyBreakdown = [];
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayDate.getTime() + 24 * 60 * 60 * 1000);

      // Find meals for this day
      const dayMeals = meals.filter(m => m.createdAt >= dayDate && m.createdAt < dayEnd);

      let dayCalories = 0;
      dayMeals.forEach(meal => {
        const effectivePortion = getEffectivePortion(meal);
        dayCalories += calculateEffectiveCalories(meal, effectivePortion);
      });

      const weekdayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });

      dailyBreakdown.push({
        date: weekdayName,
        calories: dayCalories,
        meal_count: dayMeals.length,
      });
    }

    // Fetch user profile for TDEE calculation
    const userProfile = await app.db.query.userProfiles.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
    });

    // Calculate TDEE
    let tdee = { calorie_target: 1500, protein_target: 84 };

    if (
      userProfile &&
      userProfile.weightKg &&
      userProfile.heightCm &&
      userProfile.age &&
      userProfile.gender
    ) {
      const weight = Number(userProfile.weightKg);
      const height = Number(userProfile.heightCm);
      const age = userProfile.age;
      const gender = userProfile.gender.toLowerCase();

      let bmr: number;
      if (gender === 'male') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
      } else {
        // female, non-binary, prefer_not_to_say all use female formula
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
      }

      const tdeeValue = bmr * 1.4;
      const calorieTarget = Math.round(tdeeValue * 0.70);
      const proteinTarget = Math.round(weight * 1.4);

      tdee = {
        calorie_target: calorieTarget,
        protein_target: proteinTarget,
      };
    }

    app.logger.info(
      {
        userId,
        todayCalories,
        todayMealCount,
        weekMealCount,
      },
      'Journey stats calculated'
    );

    return {
      summary: {
        today_calories: todayCalories,
        today_protein_g: todayProtein,
        today_meal_count: todayMealCount,
        week_avg_daily_calories: weekAvgDailyCalories,
        week_avg_daily_protein_g: weekAvgDailyProtein,
        week_meal_count: weekMealCount,
      },
      meals: processedMeals,
      daily_breakdown: dailyBreakdown,
      week_macros: {
        avg_daily_calories: weekAvgDailyCalories,
        avg_daily_protein_g: weekAvgDailyProtein,
        avg_daily_carbs_g: weekAvgDailyCarbs,
        avg_daily_fat_g: weekAvgDailyFat,
      },
      tdee,
    };
  });
}
