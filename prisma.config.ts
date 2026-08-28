import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 no longer accepts `url` inside the schema's datasource block, so the
 * connection string lives here instead, loaded from .env via dotenv/config
 * (Prisma 7 does not auto-load environment variables). On Vercel there is no
 * .env file and dotenv is a harmless no-op — the platform supplies the vars.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    /**
     * Runs on `prisma db seed`, `migrate dev` and `migrate reset` — and on
     * NOTHING else. In particular `prisma migrate deploy`, which is what the
     * Vercel build runs, never invokes it. See docs/DEPLOY.md.
     */
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    /**
     * Migrations prefer a DIRECT (unpooled) endpoint. Neon's pooled endpoint is
     * PgBouncer in transaction mode, and Prisma Migrate takes a session-scoped
     * advisory lock — which transaction pooling can drop, failing a deploy
     * mid-migration. It does work through the pooler in practice here, so
     * DIRECT_URL is optional; set it if a deploy ever fails on a lock timeout.
     *
     * The app itself at runtime always uses the POOLED DATABASE_URL, because
     * serverless functions open far more connections than Postgres will take.
     */
    // `env()` throws on a missing variable, so the optional one is read
    // straight off process.env (dotenv/config above has already run).
    url: process.env.DIRECT_URL ?? env('DATABASE_URL'),
  },
});
