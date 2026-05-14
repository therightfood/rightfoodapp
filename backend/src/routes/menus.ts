import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';
import * as schema from '../db/schema/schema.js';

interface MenuItem {
  name: string;
  description: string;
  price: string;
  estimated_calories: number;
  estimated_protein_g: number;
  category: string;
}

interface Recommendation {
  name: string;
  description: string;
  price: string;
  estimated_calories: number;
  estimated_protein_g: number;
  category: string;
  recommendation_reason: string;
}

interface AnalyzeResponse {
  session_id: string;
  image_url: string;
  extracted_items: MenuItem[];
  recommendations: Recommendation[];
  medication: string | null;
  dose_mg: number | null;
}

export function registerMenuRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/menus/analyze - Analyze menu image
  app.fastify.post('/api/menus/analyze', {
    schema: {
      description: 'Analyze a menu image and get GLP-1 friendly recommendations',
      tags: ['menus'],
      response: {
        200: {
          description: 'Menu analyzed successfully',
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            image_url: { type: 'string' },
            extracted_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'string' },
                  estimated_calories: { type: 'integer' },
                  estimated_protein_g: { type: 'integer' },
                  category: { type: 'string' },
                },
              },
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'string' },
                  estimated_calories: { type: 'integer' },
                  estimated_protein_g: { type: 'integer' },
                  category: { type: 'string' },
                  recommendation_reason: { type: 'string' },
                },
              },
            },
            medication: { type: ['string', 'null'] },
            dose_mg: { type: ['number', 'null'] },
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
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<AnalyzeResponse | void> => {
    try {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Analyzing menu image');

      // 1. Handle file upload
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

      // Store image to storage
      const key = `menu-images/${userId}/${Date.now()}.jpg`;
      const uploadedKey = await app.storage.upload(key, buffer);
      const { url: imageUrl } = await app.storage.getSignedUrl(uploadedKey);

      app.logger.info({ userId, key: uploadedKey }, 'Menu image uploaded');

      // Convert buffer to base64 for AI analysis
      const base64Image = buffer.toString('base64');

      // 2. First AI call - extract menu items
      app.logger.info({ userId }, 'Extracting menu items with AI');

      let extractedItems: MenuItem[] = [];
      try {
        const { text: responseText } = await generateText({
          model: gateway('google/gemini-2.5-flash'),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', image: base64Image },
                {
                  type: 'text',
                  text: 'Extract all menu items from this restaurant menu photo. Return JSON only: array of items, each with: name (string), description (string, empty string if not visible), price (string, empty string if not visible), estimated_calories (number, your best estimate), estimated_protein_g (number, your best estimate), category (one of: starter, main, dessert, drink). Return ONLY a valid JSON array, no markdown.',
                },
              ],
            },
          ],
          temperature: 0.1,
        });

        app.logger.info({ userId }, 'Parsing extracted menu items');
        extractedItems = JSON.parse(responseText);

        if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
          throw new Error('No items extracted');
        }
      } catch (err) {
        app.logger.error({ userId, err }, 'Failed to extract menu items');
        return reply.status(422).send({
          error: 'Could not read the menu. Please try a clearer photo.',
        });
      }

      // 3. Fetch user profile for medication/dose
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      const medication = userProfile?.medication;
      const doseMg = userProfile?.doseMg ? Number(userProfile.doseMg) : null;

      // 4. Second AI call - get recommendations
      let recommendations: Recommendation[] = [];

      try {
        app.logger.info({ userId }, 'Getting AI recommendations');

        // Build compact items JSON with only necessary fields
        const compactItems = extractedItems.map(item => ({
          name: item.name,
          estimated_calories: item.estimated_calories,
          estimated_protein_g: item.estimated_protein_g,
        }));
        const itemsJson = JSON.stringify(compactItems);

        // Build prompt based on whether user has medication
        let prompt: string;
        if (medication && doseMg) {
          prompt = `From this menu, which 3-5 dishes are best for someone on ${medication} ${doseMg}mg? Menu items: ${itemsJson}. Prioritize: high protein, easy to digest, not too large a portion, avoid greasy or heavy foods. Return JSON only: array of recommended items, each with: name (string, must exactly match a name from the menu), recommendation_reason (string, one sentence explaining why it suits GLP-1 users on this medication/dose). Return ONLY a valid JSON array, no markdown.`;
        } else {
          prompt = `From this menu, which 3-5 dishes are best for someone on a GLP-1 medication? Menu items: ${itemsJson}. Prioritize: high protein, easy to digest, not too large a portion, avoid greasy or heavy foods. Return JSON only: array of recommended items, each with: name (string, must exactly match a name from the menu), recommendation_reason (string, one sentence explaining why it suits GLP-1 users). Return ONLY a valid JSON array, no markdown.`;
        }

        const { text: recResponseText } = await generateText({
          model: gateway('google/gemini-2.5-flash'),
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
        });

        app.logger.info({ userId }, 'Parsing recommendations');
        const parsedRecs = JSON.parse(recResponseText);

        if (Array.isArray(parsedRecs) && parsedRecs.length > 0) {
          // Merge recommendations with extracted items
          recommendations = parsedRecs
            .map((rec: any) => {
              const matchedItem = extractedItems.find(
                item => item.name.toLowerCase() === rec.name.toLowerCase()
              );
              if (matchedItem) {
                return {
                  ...matchedItem,
                  recommendation_reason: rec.recommendation_reason,
                };
              }
              return null;
            })
            .filter((item): item is Recommendation => item !== null);
        }
      } catch (err) {
        app.logger.warn({ userId, err }, 'Failed to get recommendations, continuing without them');
        // Continue without recommendations rather than failing
        recommendations = [];
      }

      // 5. Save to database
      const sessionId = `menu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [createdSession] = await app.db
        .insert(schema.menuSessions)
        .values({
          id: sessionId,
          userId,
          imageUrl,
          extractedItems,
          recommendations,
          medication: medication || null,
          doseMg: doseMg ? doseMg.toString() : null,  // Store as string in DB (numeric column)
        })
        .returning();

      app.logger.info({ userId, sessionId, itemCount: extractedItems.length, recCount: recommendations.length }, 'Menu session saved');

      // 6. Return response
      return {
        session_id: sessionId,
        image_url: imageUrl,
        extracted_items: extractedItems,
        recommendations,
        medication: medication || null,
        dose_mg: doseMg,
      };
    } catch (err) {
      app.logger.error({ err }, 'Unexpected error during menu analysis');
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
}
