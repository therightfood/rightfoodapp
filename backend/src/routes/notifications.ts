import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { and, eq, isNotNull, gt } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

interface CheckAndSendResponse {
  checked: number;
  sent: number;
  skipped: number;
}

function getCurrentTimeInTimezone(timezone: string): { hours: number; minutes: number } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    return { hours, minutes };
  } catch {
    const now = new Date();
    return { hours: now.getUTCHours(), minutes: now.getUTCMinutes() };
  }
}

function getTimeDifferenceInMinutes(currentHours: number, currentMinutes: number, reminderHours: number, reminderMinutes: number): number {
  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  const reminderTotalMinutes = reminderHours * 60 + reminderMinutes;

  let diff = reminderTotalMinutes - currentTotalMinutes;

  // Handle midnight wrap-around
  if (diff < -720) {
    // More than 12 hours in the past, probably means it wrapped to next day
    diff += 24 * 60;
  } else if (diff > 720) {
    // More than 12 hours in the future, probably means it wrapped to prev day
    diff -= 24 * 60;
  }

  return diff;
}

export function registerNotificationRoutes(app: App) {
  // POST /api/notifications/check-and-send - Check and send push notifications
  app.fastify.post('/api/notifications/check-and-send', {
    schema: {
      description: 'Check reminders and send push notifications (scheduler endpoint)',
      tags: ['notifications'],
      response: {
        200: {
          description: 'Notifications checked and sent',
          type: 'object',
          properties: {
            checked: { type: 'integer' },
            sent: { type: 'integer' },
            skipped: { type: 'integer' },
          },
        },
        401: {
          description: 'Unauthorized - invalid scheduler secret',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<CheckAndSendResponse | void> => {
    // Check scheduler secret if configured
    const schedulerSecret = process.env.SCHEDULER_SECRET;
    if (schedulerSecret) {
      const headerSecret = request.headers['x-scheduler-secret'];
      if (headerSecret !== schedulerSecret) {
        app.logger.warn('Invalid scheduler secret');
        return reply.status(401).send({ error: 'Invalid scheduler secret' });
      }
    }

    app.logger.info('Starting check-and-send notification job');

    try {
      // Query all users with reminders enabled
      const profiles = await app.db
        .select({
          userId: schema.userProfiles.userId,
          reminderTimes: schema.userProfiles.reminderTimes,
          timezone: schema.userProfiles.timezone,
          onesignalId: schema.userProfiles.onesignalId,
          userEmail: authSchema.user.email,
          userName: authSchema.user.name,
        })
        .from(schema.userProfiles)
        .innerJoin(authSchema.user, eq(schema.userProfiles.userId, authSchema.user.id))
        .where(
          and(
            eq(schema.userProfiles.reminderEnabled, true),
            isNotNull(schema.userProfiles.reminderTimes)
          )
        );

      app.logger.info({ totalProfiles: profiles.length }, 'Fetched profiles with reminders enabled');

      const usersToNotify = new Set<string>();
      let checkedCount = 0;

      // For each user, check if any reminder time matches
      for (const profile of profiles) {
        const reminderTimes = Array.isArray(profile.reminderTimes) ? profile.reminderTimes : [];

        if (reminderTimes.length === 0) {
          continue;
        }

        checkedCount++;

        const timezone = profile.timezone || 'UTC';
        const currentTime = getCurrentTimeInTimezone(timezone);

        app.logger.debug(
          { userId: profile.userId, currentTime, reminderTimes, timezone },
          'Checking reminder times for user'
        );

        let shouldNotify = false;

        // Check each reminder time
        for (const timeStr of reminderTimes) {
          const [hoursStr, minutesStr] = timeStr.split(':');
          const reminderHours = parseInt(hoursStr);
          const reminderMinutes = parseInt(minutesStr);

          const diffInMinutes = getTimeDifferenceInMinutes(
            currentTime.hours,
            currentTime.minutes,
            reminderHours,
            reminderMinutes
          );

          app.logger.debug(
            { userId: profile.userId, timeStr, diffInMinutes },
            'Calculated time difference'
          );

          if (Math.abs(diffInMinutes) <= 15) {
            // Check if user already logged a meal in the last 2 hours
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

            const recentMeals = await app.db
              .select()
              .from(schema.mealAnalyses)
              .where(
                and(
                  eq(schema.mealAnalyses.userId, profile.userId),
                  isNotNull(schema.mealAnalyses.actualPortionPct),
                  gt(schema.mealAnalyses.createdAt, twoHoursAgo)
                )
              );

            app.logger.debug(
              { userId: profile.userId, recentMealCount: recentMeals.length },
              'Checked recent meals'
            );

            if (recentMeals.length === 0) {
              shouldNotify = true;
              break;
            }
          }
        }

        if (shouldNotify) {
          usersToNotify.add(profile.userId);
        }
      }

      const sentCount = usersToNotify.size;
      const skippedCount = checkedCount - sentCount;

      // Send notifications to each user
      for (const userId of usersToNotify) {
        const profile = profiles.find(p => p.userId === userId);
        if (!profile || !profile.onesignalId) {
          app.logger.warn({ userId }, 'No OneSignal ID found for user');
          continue;
        }

        try {
          const onesignalRestKey = process.env.ONESIGNAL_REST_API_KEY;
          const onesignalAppId = process.env.ONESIGNAL_APP_ID;

          if (!onesignalRestKey || !onesignalAppId) {
            app.logger.warn('OneSignal credentials not configured');
            continue;
          }

          const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${onesignalRestKey}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              app_id: onesignalAppId,
              include_external_user_ids: [userId],
              channel_for_rest_payload: 'push',
              headings: { en: 'Time to scan your meal' },
              contents: { en: 'Open Right Food to check your portion before eating.' },
              url: 'rightfood://scan',
              data: { screen: 'scan' },
            }),
          });

          if (response.ok) {
            app.logger.info({ userId }, 'Notification sent successfully');
          } else {
            const errorBody = await response.text();
            app.logger.error({ userId, status: response.status, body: errorBody }, 'Failed to send notification');
          }
        } catch (err) {
          app.logger.error({ userId, err }, 'Error sending notification');
        }
      }

      app.logger.info({ checked: checkedCount, sent: sentCount, skipped: skippedCount }, 'Check-and-send job completed');

      return {
        checked: checkedCount,
        sent: sentCount,
        skipped: skippedCount,
      };
    } catch (err) {
      app.logger.error({ err }, 'Error in check-and-send job');
      return reply.status(500).send({ error: 'Failed to check and send notifications' });
    }
  });
}
