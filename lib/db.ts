import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

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
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

globalForPrisma.prisma = db;
