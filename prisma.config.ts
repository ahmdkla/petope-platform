import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 no longer accepts `url` inside the schema's datasource block, so the
 * connection string lives here instead, loaded from .env via dotenv/config
 * (Prisma 7 does not auto-load environment variables).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Runs automatically on `prisma migrate reset`.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
