import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { recordQuery, isCollecting } from './query-log';

/**
 * Prisma 7 will not construct a client without a driver adapter, and it no
 * longer auto-loads `.env` — hence the `dotenv/config` import above. Missing
 * that is the usual cause of a runtime `P1010` on a project where the Prisma
 * CLI works fine, because the CLI loads env through prisma.config.ts instead.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
}

const adapter = new PrismaPg({ connectionString });

/**
 * One client per process, pinned to `globalThis`.
 *
 * In development this survives hot reloads, which would otherwise construct a
 * client per edit and exhaust the connection pool. In production it matters for
 * a different reason: Next.js can bundle this module into more than one server
 * chunk, and a plain module-level constant would then give each chunk its own
 * client and its own pool. On serverless, where instances are already many,
 * that multiplies connections against a database that will refuse them.
 *
 * Pinning in both environments makes "one client per instance" true rather than
 * merely likely. A serverless instance is reused across invocations, so this is
 * also what stops a connection being opened per request.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaQueryListener?: boolean;
};

const isDev = process.env.NODE_ENV === 'development';

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    /**
     * TEMPORARY INSTRUMENTATION (development only).
     *
     * `emit: 'event'` rather than `'stdout'` because the stdout logger prints
     * the query but gives no programmatic access to its duration — and the
     * duration is the thing being measured. The listener below feeds
     * lib/query-log.ts, which aggregates per render.
     */
    log: isDev
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['error'],
  });

/**
 * Registered once per process, not once per module evaluation. In dev, HMR
 * re-runs this module while `db` survives on globalThis, so an unguarded
 * `$on` accumulates a listener per reload — every query then logs several
 * times and, worse, is counted several times, which would silently inflate the
 * very measurements this exists to produce.
 */
if (isDev && !globalForPrisma.prismaQueryListener) {
  globalForPrisma.prismaQueryListener = true;
  // Typed loosely: the event payload's shape depends on the `log` config above,
  // which TypeScript cannot narrow from a conditional expression.
  (db as unknown as {
    $on: (e: 'query', cb: (ev: { query: string; duration: number }) => void) => void;
  }).$on('query', (ev) => {
    recordQuery(ev.query, ev.duration);
    // Only print individual queries when nothing is aggregating them, so a
    // measured block gets one tidy summary instead of a duplicated firehose.
    if (!isCollecting()) {
      console.log(`[prisma] ${ev.duration}ms  ${ev.query.replace(/\s+/g, ' ').slice(0, 110)}`);
    }
  });
}

globalForPrisma.prisma = db;
