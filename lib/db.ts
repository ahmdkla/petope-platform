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

// Reuse the client across hot reloads in dev; a new one per reload exhausts
// the connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
