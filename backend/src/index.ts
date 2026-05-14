import { createApplication, resend } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerScanRoutes } from './routes/scan.js';

// Combine app and auth schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Setup authentication with email/password and password reset
app.withAuth({
  emailAndPassword: {
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: 'noreply@example.com',
        to: user.email,
        subject: 'Reset your password',
        html: `<p>Click the link below to reset your password:</p><p><a href="${url}">Reset Password</a></p>`,
      });
    },
  },
});

// Setup storage for file uploads
app.withStorage();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerProfileRoutes(app);
registerScanRoutes(app);

await app.run();
app.logger.info('Application running');
