import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 no longer accepts `url` inside the schema's datasource block, so the
 * connection string lives here instead. DATABASE_URL is a local placeholder —
 * nothing in this project connects to a database yet.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
