/**
 * Tops an already-seeded database up to the full set of blacklist cases.
 *
 * `prisma/seed.ts` produces all seven on a fresh `migrate reset`, but the seed
 * is deliberately not idempotent — re-running it fails on duplicate emails
 * rather than quietly creating a second cast. This adds only what is missing,
 * from the same `blacklist-cases.ts` table, so a demo database that predates
 * those cases can catch up without destroying its append-only ledger.
 *
 *   npx tsx scripts/seed-blacklist.ts
 *
 * Safe to run repeatedly: every step checks first.
 */
import 'dotenv/config';
import { auth } from '../lib/auth';
import { db } from '../lib/db';
import { BLACKLISTED, BLACKLIST_ACCOUNTS } from '../prisma/blacklist-cases';

const PASSWORD = 'Exsaverse789';
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);

async function main() {
  const admin = await db.user.findUnique({ where: { email: 'admin@exsaverse.demo' } });
  if (!admin) throw new Error('No admin account — run the full seed first.');

  let created = 0;
  let upheld = 0;

  for (const account of BLACKLIST_ACCOUNTS) {
    let user = await db.user.findUnique({ where: { email: account.email } });

    if (!user) {
      // Through Better Auth, like the seed: it is the only path that writes a
      // real scrypt hash. These accounts cannot sign in once blacklisted, but
      // they should be identical to every other seeded account until then.
      const res = await auth.api.signUpEmail({
        body: { email: account.email, password: PASSWORD, name: account.displayName },
      });
      user = await db.user.update({
        where: { id: res.user.id },
        data: { emailVerified: true, termsAcceptedAt: new Date(), isTest: false },
      });
      created += 1;
    }

    const c = BLACKLISTED.find((x) => x.handle === account.displayName);
    if (!c) continue;

    const reporter = await db.user.findFirst({
      where: { displayName: c.reporter },
      select: { id: true },
    });
    if (!reporter) throw new Error(`Reporter ${c.reporter} not found — run the full seed first.`);

    // The report comes first and the blacklisting follows from it, because
    // /blacklist promises every entry was reviewed before it was published.
    const existing = await db.scammerReport.findFirst({
      where: { accusedUserId: user.id, status: 'UPHELD' },
      select: { id: true },
    });
    if (!existing) {
      await db.scammerReport.create({
        data: {
          reporterId: reporter.id,
          accusedUserId: user.id,
          accusedHandle: c.handle,
          category: c.category,
          evidence: c.evidence,
          status: 'UPHELD',
          reviewedById: admin.id,
          reviewedAt: ago(c.daysAgo * DAY),
          reviewNote: c.note,
          createdAt: ago((c.daysAgo + 2) * DAY),
        },
      });
      upheld += 1;
    }

    if (user.status !== 'BLACKLISTED') {
      await db.user.update({
        where: { id: user.id },
        data: {
          status: 'BLACKLISTED',
          blacklistReason: c.reason,
          blacklistedAt: ago(c.daysAgo * DAY),
          blacklistedById: admin.id,
        },
      });
    }
  }

  const total = await db.user.count({ where: { status: 'BLACKLISTED', isTest: false } });
  console.log(`accounts created: ${created}`);
  console.log(`upheld reports filed: ${upheld}`);
  console.log(`blacklisted accounts now visible on /blacklist: ${total}`);
}

main().finally(() => db.$disconnect());
