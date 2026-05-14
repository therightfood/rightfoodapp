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
  status: string;
  created_at: string;
  updated_at: string;
}

interface AnalysesListResponse {
  analyses: MealAnalysisResponse[];
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
            status: { type: 'string' },
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
  ): Promise<MealAnalysisResponse | void> => {
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
          portionSuggestionPct: baselinePortionPct.toString(),
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(schema.mealAnalyses.id, createdAnalysis.id))
        .returning();

      app.logger.info({ analysisId: updatedAnalysis.id, userId }, 'Analysis completed successfully');

      return formatResponse(updatedAnalysis);
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
}
