/**
 * Prints the dynamic-route ids the crawler needs, as JSON.
 * Run: IDS=$(npx tsx scripts/crawl-ids.ts) node scripts/crawl.mjs
 *
 * The crawler substitutes these into /u/[id], /deals/[id] and /support/[id].
 * Without them those routes are visited as the literal string "undefined" and
 * every one is reported as a 404 — a false positive that hides real failures.
 */
import 'dotenv/config';
import { db } from '../lib/db';

async function main() {
  const [user, mm, deal, ticket] = await Promise.all([
    db.user.findFirst({ where: { role: 'USER', status: 'ACTIVE' }, select: { id: true } }),
    db.user.findFirst({ where: { role: 'MIDDLEMAN', status: 'ACTIVE' }, select: { id: true } }),
    db.deal.findFirst({ where: { isTest: false }, select: { id: true } }),
    db.supportTicket.findFirst({ select: { id: true } }),
  ]);
  console.log(JSON.stringify({ user: user?.id, mm: mm?.id, deal: deal?.id, ticket: ticket?.id }));
}

main().finally(() => db.$disconnect());
