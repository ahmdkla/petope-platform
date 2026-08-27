/**
 * Demo seed. Run automatically by `prisma migrate reset`.
 *
 * Users are created through Better Auth's server API rather than by inserting
 * rows directly — that is the only way the stored password is a real scrypt
 * hash that will actually sign in. Domain fields are patched on afterwards.
 */
import 'dotenv/config';
import { auth } from '../lib/auth';
import { db } from '../lib/db';

const PASSWORD = 'exsaverse-demo-2026';

/**
 * Money is stored in the asset's SMALLEST UNIT, never as a display number.
 * USDC/USDT have 6 decimals, SOL has 9. Writing `1500n` for "$15" would store
 * $0.0015 — these helpers exist so that mistake is impossible here.
 */
const usd = (n: number) => BigInt(Math.round(n * 1_000_000));
const sol = (n: number) => BigInt(Math.round(n * 1_000_000_000));

type Seed = {
  email: string;
  displayName: string;
  role: 'USER' | 'MIDDLEMAN' | 'MAIN_MIDDLEMAN' | 'ADMIN';
  isVerifiedMm?: boolean;
  workingHoursUtc?: string;
  tradesSecured?: number;
};

const PEOPLE: Seed[] = [
  { email: 'akla@exsaverse.demo', displayName: 'akla', role: 'MAIN_MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: '09:00-21:00 UTC', tradesSecured: 4820 },
  { email: 'rei@exsaverse.demo', displayName: 'rei', role: 'MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: '13:00-23:00 UTC', tradesSecured: 1960 },
  { email: 'nadia@exsaverse.demo', displayName: 'nadia', role: 'MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: 'flexible', tradesSecured: 774 },
  // Deliberately unverified, so the roster's verified badge is visibly doing work.
  { email: 'tobi@exsaverse.demo', displayName: 'tobi', role: 'MIDDLEMAN', isVerifiedMm: false, workingHoursUtc: '02:00-10:00 UTC', tradesSecured: 31 },
  { email: 'admin@exsaverse.demo', displayName: 'admin', role: 'ADMIN' },
  { email: 'buyer@exsaverse.demo', displayName: 'buyer_one', role: 'USER' },
  { email: 'seller@exsaverse.demo', displayName: 'seller_one', role: 'USER' },
];

async function main() {
  console.log('seeding...');

  const ids: Record<string, string> = {};

  for (const p of PEOPLE) {
    const res = await auth.api.signUpEmail({
      body: { email: p.email, password: PASSWORD, name: p.displayName },
    });
    const id = res.user.id;
    ids[p.displayName] = id;

    await db.user.update({
      where: { id },
      data: {
        role: p.role,
        isVerifiedMm: p.isVerifiedMm ?? false,
        workingHoursUtc: p.workingHoursUtc ?? null,
        tradesSecured: p.tradesSecured ?? 0,
        emailVerified: true, // demo accounts; no mail provider is wired up
        termsAcceptedAt: new Date(),
      },
    });
  }
  console.log(`  ${PEOPLE.length} users`);

  // Admin-tunable values — never hardcoded in logic.
  await db.adminSetting.createMany({
    data: [
      { key: 'collateral.minimum', value: { amount: 5_000_000, asset: 'USDC', note: 'smallest unit = $5.00 USDC' }, description: 'Minimum seller collateral, all methods.', updatedById: ids.admin },
      { key: 'mmFee.default', value: { type: 'percentage', percent: 5, minimum: 1_000_000, asset: 'USDC' }, description: 'Default MM fee. Structure still under review.', updatedById: ids.admin },
      { key: 'timers.overrides', value: {}, description: 'Per-method release timer overrides. Empty = use deal-method config.', updatedById: ids.admin },
    ],
  });
  console.log('  3 admin settings');

  await db.listing.createMany({
    data: [
      { side: 'SELL', authorId: ids.seller_one, item: 'Fabled Genesis', chain: 'Solana', price: usd(15), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 3, quantityRemaining: 3, collateral: usd(7), acceptsOffers: true },
      { side: 'SELL', authorId: ids.seller_one, item: 'Northlake', chain: 'Base', price: usd(40), priceType: 'FOR_ALL', payment: 'USDT', specific: 'FCFS', type: 'MINT', quantity: 5, quantityRemaining: 2, collateral: usd(12), acceptsOffers: true },
      { side: 'BUY', authorId: ids.buyer_one, item: 'Aster Pass', chain: 'Ethereum', price: sol(0.25), priceType: 'FOR_EACH', payment: 'SOL', specific: 'GTD', type: 'ANY', quantity: 2, quantityRemaining: 2, acceptsOffers: true },
      { side: 'SELL', authorId: ids.seller_one, item: 'Reverie', chain: 'Robinhood', price: usd(9), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 1, quantityRemaining: 0, status: 'FULFILLED' },
    ],
  });
  console.log('  4 listings');

  // Completed deals, so the roster shows real vouch counts.
  const deals = [
    { ref: 'AKLA-08-BUYERONE-REVERIE', batch: 8, mm: ids.akla, method: 'OTC' as const },
    { ref: 'REI-08-BUYERONE-NORTHLAKE', batch: 8, mm: ids.rei, method: 'MINT_FOR_YOU' as const },
    { ref: 'AKLA-09-BUYERONE-ASTER', batch: 9, mm: ids.akla, method: 'WALLET_SUBMIT' as const },
  ];

  for (const d of deals) {
    const deal = await db.deal.create({
      data: {
        reference: d.ref,
        batchNumber: d.batch,
        buyerId: ids.buyer_one,
        sellerId: ids.seller_one,
        middlemanId: d.mm,
        method: d.method,
        status: 'COMPLETED',
        projectName: d.ref.split('-').pop() ?? 'Project',
        chain: 'Solana',
        dealAmount: usd(45),
        mmFee: usd(2.25),
        asset: 'USDC',
        quantity: 1,
        specific: 'GTD',
        priceType: 'FOR_EACH',
        termsLockedAt: new Date(),
        fundedAt: new Date(),
        completedAt: new Date(),
      },
    });

    await db.transactionLog.create({
      data: { dealId: deal.id, actorId: d.mm, action: 'FUNDS_RELEASED', amount: usd(45), asset: 'USDC', fromStatus: 'AWAITING_CONFIRMATION', toStatus: 'COMPLETED' },
    });

    await db.vouch.create({
      data: { dealId: deal.id, authorId: ids.buyer_one, middlemanId: d.mm, body: 'Fast and clear throughout. Confirmed both payments within minutes.' },
    });
  }
  console.log(`  ${deals.length} completed deals with vouches`);

  console.log('\ndemo accounts (all share one password):');
  for (const p of PEOPLE) console.log(`  ${p.email.padEnd(28)} ${p.role}`);
  console.log(`  password: ${PASSWORD}`);
  console.log('\nThese are demo accounts. No real users, no real funds.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
