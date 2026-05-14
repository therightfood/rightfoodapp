import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';
import * as schema from '../db/schema/schema.js';

interface ExtractIngredientsResponse {
  ingredients: string[];
}

interface Recipe {
  name: string;
  ingredients: string[];
  instructions: string[];
  estimated_calories: number;
  estimated_protein_g: number;
  glp1_friendly: boolean;
  reasons: string[];
}

interface GenerateRecipesBody {
  ingredients: string;
  medication?: string;
  dose_mg?: number;
}

interface GenerateRecipesResponse {
  session_id: string;
  recipes: Recipe[];
}

export function registerRecipeRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/recipes/extract-ingredients - Extract ingredients from fridge/pantry photo
  app.fastify.post('/api/recipes/extract-ingredients', {
    schema: {
      description: 'Extract food ingredients from a photo using AI vision',
      tags: ['recipes'],
      response: {
        200: {
          description: 'Ingredients extracted successfully',
          type: 'object',
          properties: {
            ingredients: {
              type: 'array',
              items: { type: 'string' },
            },
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
        422: {
          description: 'Analysis failed',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<ExtractIngredientsResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Extracting ingredients from photo');

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

    try {
      // Convert buffer to base64
      const base64Image = buffer.toString('base64');

      app.logger.info({ userId }, 'Analyzing image with AI for ingredients');

      // Call Gemini 2.0 Flash for ingredient extraction
      const { text: responseText } = await generateText({
        model: gateway('google/gemini-2.5-flash'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: base64Image },
              {
                type: 'text',
                text: 'Identify all visible food items and ingredients in this photo. Return a JSON array of strings with ingredient names. Example: ["chicken breast", "broccoli", "olive oil"]. Return ONLY valid JSON array, no markdown, no explanation.',
              },
            ],
          },
        ],
        temperature: 0.1,
      });

      app.logger.info({ userId }, 'AI response received, parsing ingredients');

      // Parse AI response
      let ingredients: string[];
      try {
        ingredients = JSON.parse(responseText);
        if (!Array.isArray(ingredients)) {
          throw new Error('Response is not an array');
        }
      } catch (parseErr) {
        app.logger.error({ userId, err: parseErr, response: responseText }, 'Failed to parse ingredients response');
        return reply.status(422).send({
          error: 'Failed to extract ingredients',
        });
      }

      app.logger.info({ userId, ingredientCount: ingredients.length }, 'Ingredients extracted successfully');

      return { ingredients };
    } catch (err) {
      app.logger.error({ userId, err }, 'Error during ingredient extraction');
      return reply.status(422).send({
        error: 'Failed to extract ingredients',
      });
    }
  });

  // POST /api/recipes/generate - Generate GLP-1 friendly recipes
  app.fastify.post('/api/recipes/generate', {
    schema: {
      description: 'Generate GLP-1 friendly recipes based on ingredients',
      tags: ['recipes'],
      body: {
        type: 'object',
        required: ['ingredients'],
        properties: {
          ingredients: { type: 'string', description: 'Comma-separated list of ingredients' },
          medication: { type: 'string', description: 'GLP-1 medication (optional, uses profile if not provided)' },
          dose_mg: { type: 'number', description: 'Medication dose in mg (optional, uses profile if not provided)' },
        },
      },
      response: {
        200: {
          description: 'Recipes generated successfully',
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            recipes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  ingredients: { type: 'array', items: { type: 'string' } },
                  instructions: { type: 'array', items: { type: 'string' } },
                  estimated_calories: { type: 'integer' },
                  estimated_protein_g: { type: 'integer' },
                  glp1_friendly: { type: 'boolean' },
                  reasons: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - ingredients are required',
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
        422: {
          description: 'Generation failed',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: GenerateRecipesBody }>,
    reply: FastifyReply
  ): Promise<GenerateRecipesResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { ingredients, medication: bodyMedication, dose_mg: bodyDose } = request.body;

    // Validate ingredients parameter
    if (!ingredients || typeof ingredients !== 'string' || ingredients.trim() === '') {
      app.logger.warn({ userId }, 'Missing or empty ingredients parameter');
      return reply.status(400).send({ error: 'ingredients parameter is required and must be a non-empty string' });
    }

    app.logger.info({ userId, ingredients }, 'Generating recipes');

    // Fetch user profile for medication/dose fallback
    const userProfile = await app.db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, userId),
    });

    const medication = bodyMedication || userProfile?.medication || null;
    const doseMg = bodyDose !== undefined ? bodyDose : (userProfile?.doseMg ? Number(userProfile.doseMg) : null);

    try {
      // Build AI prompt
      const medicationContext = medication && doseMg ? ` The user takes ${medication} ${doseMg}mg for GLP-1 weight management.` : '';
      const prompt = `Generate 3 GLP-1 friendly recipes using these ingredients: ${ingredients}.${medicationContext}

Return a JSON array with exactly 3 recipe objects. Each recipe must have:
- name: string (recipe name)
- ingredients: array of strings (ingredients needed with quantities)
- instructions: array of strings (step-by-step cooking instructions, 4-6 steps)
- estimated_calories: number (total calories for the full recipe)
- estimated_protein_g: number (total protein in grams)
- glp1_friendly: boolean (true if suitable for GLP-1 weight loss)
- reasons: array of strings (2-3 reasons why this recipe is GLP-1 friendly)

Focus on high-protein, low-carb, high-fiber recipes. Return ONLY valid JSON array, no markdown, no explanation.`;

      app.logger.info({ userId }, 'Calling AI for recipe generation');

      const { text: responseText } = await generateText({
        model: gateway('google/gemini-2.5-flash'),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      app.logger.info({ userId }, 'AI response received, parsing recipes');

      // Parse AI response
      let recipes: Recipe[];
      try {
        recipes = JSON.parse(responseText);
        if (!Array.isArray(recipes) || recipes.length === 0) {
          throw new Error('Response is not a valid array');
        }
      } catch (parseErr) {
        app.logger.error({ userId, err: parseErr, response: responseText }, 'Failed to parse recipes response');
        return reply.status(422).send({
          error: 'Failed to generate recipes',
        });
      }

      // Create recipe session
      const sessionId = `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [createdSession] = await app.db
        .insert(schema.recipeSessions)
        .values({
          id: sessionId,
          userId,
          ingredientsInput: ingredients,
          recipesReturned: recipes,
        })
        .returning();

      app.logger.info({ userId, sessionId, recipeCount: recipes.length }, 'Recipes generated and session saved');

      return {
        session_id: sessionId,
        recipes,
      };
    } catch (err) {
      app.logger.error({ userId, err }, 'Error during recipe generation');
      return reply.status(422).send({
        error: 'Failed to generate recipes',
      });
    }
  });
}
