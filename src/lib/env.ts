import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  CRON_SECRET: z.string().min(1).optional(),
});

export const env = schema.parse(process.env);
