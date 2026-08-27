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
import type { ListingSide, ListingType, PaymentAsset, PriceType, SpotType } from '@prisma/client';

const PASSWORD = 'exsaverse-demo-2026';

/**
 * Money is stored in the asset's SMALLEST UNIT, never as a display number.
 * USDC/USDT have 6 decimals, SOL has 9. Writing `1500n` for "$15" would store
 * $0.0015 — these helpers exist so that mistake is impossible here.
 */
const usd = (n: number) => BigInt(Math.round(n * 1_000_000));
const sol = (n: number) => BigInt(Math.round(n * 1_000_000_000));

/** Two middlemen per shift gives 24-hour coverage. */
const SHIFTS = {
  night: '00:00-08:00 UTC',
  day: '08:00-16:00 UTC',
  evening: '16:00-24:00 UTC',
} as const;

type Seed = {
  email: string;
  displayName: string;
  role: 'USER' | 'MIDDLEMAN' | 'MAIN_MIDDLEMAN' | 'ADMIN';
  isVerifiedMm?: boolean;
  workingHoursUtc?: string;
  tradesSecured?: number;
};

const PEOPLE: Seed[] = [
  // --- night shift ---
  { email: 'akla@exsaverse.demo', displayName: 'akla', role: 'MAIN_MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: SHIFTS.night, tradesSecured: 4820 },
  { email: 'rei@exsaverse.demo', displayName: 'rei', role: 'MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: SHIFTS.night, tradesSecured: 1960 },
  // --- day shift ---
  { email: 'nadia@exsaverse.demo', displayName: 'nadia', role: 'MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: SHIFTS.day, tradesSecured: 3140 },
  { email: 'juno@exsaverse.demo', displayName: 'juno', role: 'MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: SHIFTS.day, tradesSecured: 774 },
  // --- evening shift ---
  { email: 'sable@exsaverse.demo', displayName: 'sable', role: 'MIDDLEMAN', isVerifiedMm: true, workingHoursUtc: SHIFTS.evening, tradesSecured: 2255 },
  // Deliberately unverified, so the roster's verified badge is visibly working.
  { email: 'tobi@exsaverse.demo', displayName: 'tobi', role: 'MIDDLEMAN', isVerifiedMm: false, workingHoursUtc: SHIFTS.evening, tradesSecured: 31 },

  { email: 'admin@exsaverse.demo', displayName: 'admin', role: 'ADMIN' },
  { email: 'buyer@exsaverse.demo', displayName: 'buyer_one', role: 'USER' },
  { email: 'buyer2@exsaverse.demo', displayName: 'buyer_two', role: 'USER' },
  { email: 'buyer3@exsaverse.demo', displayName: 'buyer_three', role: 'USER' },
  { email: 'seller@exsaverse.demo', displayName: 'seller_one', role: 'USER' },
  { email: 'seller2@exsaverse.demo', displayName: 'seller_two', role: 'USER' },
];

type ListingSeed = {
  side: ListingSide;
  author: string;
  item: string;
  chain: string;
  price: bigint;
  priceType: PriceType;
  payment: PaymentAsset;
  specific: SpotType;
  type: ListingType;
  quantity: number;
  /** Defaults to quantity. Lower means partially sold. */
  remaining?: number;
  collateral?: bigint | null;
  acceptsOffers?: boolean;
  promoted?: boolean;
  projectLink?: string;
};

const LISTINGS: ListingSeed[] = [
  // --- Solana ---
  { side: 'SELL', author: 'seller_one', item: 'Fabled Genesis', chain: 'Solana', price: usd(15), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 8, remaining: 5, collateral: usd(7), acceptsOffers: true, promoted: true, projectLink: 'https://x.com/fabledgenesis' },
  { side: 'SELL', author: 'seller_two', item: 'Solstice Pass', chain: 'Solana', price: usd(22), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'MINT', quantity: 4, collateral: usd(12), acceptsOffers: true },
  { side: 'SELL', author: 'seller_one', item: 'Cryptid Society', chain: 'Solana', price: sol(0.45), priceType: 'FOR_EACH', payment: 'SOL', specific: 'FCFS', type: 'WALLET_SURRENDER', quantity: 6, remaining: 2, collateral: sol(0.3) },
  { side: 'SELL', author: 'seller_two', item: 'Lumen Protocol', chain: 'Solana', price: usd(9), priceType: 'FOR_EACH', payment: 'USDT', specific: 'FCFS', type: 'ANY', quantity: 12, remaining: 12 },
  { side: 'SELL', author: 'seller_one', item: 'Halcyon Days', chain: 'Solana', price: usd(60), priceType: 'FOR_ALL', payment: 'USDC', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 3, collateral: usd(20), acceptsOffers: true },
  { side: 'SELL', author: 'seller_two', item: 'Nocturne', chain: 'Solana', price: usd(18), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 5, remaining: 0, collateral: usd(9) },
  { side: 'SELL', author: 'seller_one', item: 'Tidal Drift', chain: 'Solana', price: sol(1.2), priceType: 'FOR_EACH', payment: 'SOL', specific: 'GTD', type: 'MINT', quantity: 2, collateral: sol(0.8) },
  { side: 'SELL', author: 'seller_two', item: 'Paper Lanterns', chain: 'Solana', price: usd(11), priceType: 'FOR_EACH', payment: 'USDC', specific: 'FCFS', type: 'ANY', quantity: 20, remaining: 14, acceptsOffers: true },

  // --- Base ---
  { side: 'SELL', author: 'seller_one', item: 'Northlake', chain: 'Base', price: usd(40), priceType: 'FOR_ALL', payment: 'USDT', specific: 'FCFS', type: 'MINT', quantity: 5, remaining: 5, collateral: usd(12), acceptsOffers: true },
  { side: 'SELL', author: 'seller_two', item: 'Basecamp Founders', chain: 'Base', price: usd(35), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 3, remaining: 1, collateral: usd(15), promoted: true },
  { side: 'SELL', author: 'seller_one', item: 'Onchain Summer', chain: 'Base', price: usd(7), priceType: 'FOR_EACH', payment: 'USDC', specific: 'FCFS', type: 'ANY', quantity: 25, remaining: 18 },
  { side: 'SELL', author: 'seller_two', item: 'Meridian', chain: 'Base', price: usd(28), priceType: 'FOR_EACH', payment: 'USDT', specific: 'GTD', type: 'WALLET_SURRENDER', quantity: 4, collateral: usd(14), acceptsOffers: true },
  { side: 'SELL', author: 'seller_one', item: 'Gradient Club', chain: 'Base', price: usd(50), priceType: 'FOR_ALL', payment: 'USDC', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 2 },

  // --- Ethereum ---
  { side: 'SELL', author: 'seller_two', item: 'Aster Pass', chain: 'Ethereum', price: sol(0.9), priceType: 'FOR_EACH', payment: 'SOL', specific: 'GTD', type: 'MINT', quantity: 3, remaining: 2, collateral: sol(0.5), acceptsOffers: true },
  { side: 'SELL', author: 'seller_one', item: 'Ordinal Row', chain: 'Ethereum', price: usd(120), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 2, collateral: usd(60) },
  { side: 'SELL', author: 'seller_two', item: 'Vellum', chain: 'Ethereum', price: usd(45), priceType: 'FOR_EACH', payment: 'USDT', specific: 'FCFS', type: 'ANY', quantity: 6, remaining: 3 },
  { side: 'SELL', author: 'seller_one', item: 'Static Bloom', chain: 'Ethereum', price: usd(30), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'WALLET_SURRENDER', quantity: 4, collateral: usd(18), acceptsOffers: true },
  { side: 'SELL', author: 'seller_two', item: 'Reverie', chain: 'Robinhood', price: usd(9), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 3, remaining: 1 },

  // --- buyers looking ---
  { side: 'BUY', author: 'buyer_one', item: 'Fabled Genesis', chain: 'Solana', price: usd(13), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'ANY', quantity: 2, acceptsOffers: true },
  { side: 'BUY', author: 'buyer_two', item: 'Solstice Pass', chain: 'Solana', price: usd(20), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'MINT', quantity: 1 },
  { side: 'BUY', author: 'buyer_three', item: 'Basecamp Founders', chain: 'Base', price: usd(32), priceType: 'FOR_EACH', payment: 'USDT', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 3, acceptsOffers: true },
  { side: 'BUY', author: 'buyer_one', item: 'Onchain Summer', chain: 'Base', price: usd(6), priceType: 'FOR_EACH', payment: 'USDC', specific: 'FCFS', type: 'ANY', quantity: 10 },
  { side: 'BUY', author: 'buyer_two', item: 'Ordinal Row', chain: 'Ethereum', price: usd(100), priceType: 'FOR_EACH', payment: 'USDC', specific: 'GTD', type: 'ANY', quantity: 1, acceptsOffers: true },
  { side: 'BUY', author: 'buyer_three', item: 'Tidal Drift', chain: 'Solana', price: sol(1), priceType: 'FOR_EACH', payment: 'SOL', specific: 'GTD', type: 'MINT', quantity: 2 },
  { side: 'BUY', author: 'buyer_one', item: 'Meridian', chain: 'Base', price: usd(25), priceType: 'FOR_ALL', payment: 'USDT', specific: 'GTD', type: 'ANY', quantity: 2, acceptsOffers: true },
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
  console.log(`  ${PEOPLE.length} users (6 middlemen across 3 shifts)`);

  // Admin-tunable values — never hardcoded in logic.
  await db.adminSetting.createMany({
    data: [
      {
        key: 'collateral.minimum',
        value: { amount: 5_000_000, asset: 'USDC', note: 'smallest unit = $5.00 USDC' },
        description: 'Minimum seller collateral, all methods.',
        updatedById: ids.admin,
      },
      {
        key: 'mmFee.config',
        value: {
          percentBasisPoints: 500,
          floor: { USDC: 5_000_000, USDT: 5_000_000, SOL: 30_000_000 },
          refundWindowHours: 24,
          note: 'fee = max(floor, (dealAmount + collateral) * 5%). Floors are per-asset smallest units: there is no price feed, so the SOL floor is set by hand and drifts as SOL moves.',
        },
        description: 'MM fee structure and the scammer refund window.',
        updatedById: ids.admin,
      },
      {
        key: 'listing.maxConcurrentDeals',
        value: { max: 7 },
        description: 'How many active deals one listing may carry at once.',
        updatedById: ids.admin,
      },
      {
        key: 'timers.overrides',
        value: {},
        description: 'Per-method release timer overrides. Empty = use deal-method config.',
        updatedById: ids.admin,
      },
    ],
  });
  console.log('  4 admin settings');

  const listingIds: Record<string, string> = {};
  for (const l of LISTINGS) {
    const remaining = l.remaining ?? l.quantity;
    const created = await db.listing.create({
      data: {
        side: l.side,
        authorId: ids[l.author],
        item: l.item,
        chain: l.chain,
        price: l.price,
        priceType: l.priceType,
        payment: l.payment,
        specific: l.specific,
        type: l.type,
        quantity: l.quantity,
        quantityRemaining: remaining,
        collateral: l.collateral ?? null,
        acceptsOffers: l.acceptsOffers ?? false,
        promoted: l.promoted ?? false,
        promotedUntil: l.promoted ? new Date(Date.now() + 14 * 864e5) : null,
        projectLink: l.projectLink ?? null,
        // Zero remaining is sold out; it stays in the feed, it just takes no
        // new deals.
        status: remaining <= 0 ? 'SOLD_OUT' : 'ACTIVE',
      },
    });
    listingIds[`${l.side}:${l.item}`] = created.id;
  }
  const soldOut = LISTINGS.filter((l) => (l.remaining ?? l.quantity) <= 0).length;
  const partial = LISTINGS.filter(
    (l) => l.remaining !== undefined && l.remaining > 0 && l.remaining < l.quantity,
  ).length;
  console.log(`  ${LISTINGS.length} listings (${partial} partially sold, ${soldOut} sold out)`);

  /**
   * Competing deals on one listing, so the multi-deal UI has something real to
   * show. None of these reserve spots — they are open, and spots only leave
   * supply at funding.
   */
  let batch = 1;
  const competing = [
    { listing: 'SELL:Fabled Genesis', buyer: 'buyer_one', spots: 3, mm: 'akla' },
    { listing: 'SELL:Fabled Genesis', buyer: 'buyer_two', spots: 2, mm: null },
    { listing: 'SELL:Fabled Genesis', buyer: 'buyer_three', spots: 4, mm: null },
    { listing: 'SELL:Cryptid Society', buyer: 'buyer_one', spots: 2, mm: 'rei' },
    { listing: 'SELL:Cryptid Society', buyer: 'buyer_two', spots: 1, mm: null },
    { listing: 'SELL:Basecamp Founders', buyer: 'buyer_three', spots: 1, mm: 'nadia' },
  ];

  for (const c of competing) {
    const listingId = listingIds[c.listing];
    if (!listingId) continue;
    const listing = await db.listing.findUniqueOrThrow({ where: { id: listingId } });

    const deal = await db.deal.create({
      data: {
        reference: `${String(batch).padStart(2, '0')}-${c.buyer.toUpperCase().replace(/[^A-Z]/g, '')}-${listing.item.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10)}`,
        batchNumber: batch,
        listingId,
        buyerId: ids[c.buyer],
        sellerId: listing.authorId,
        middlemanId: c.mm ? ids[c.mm] : null,
        status: c.mm ? 'CLAIMED' : 'OPEN',
        claimedAt: c.mm ? new Date() : null,
        projectName: listing.item,
        chain: listing.chain,
        dealAmount:
          listing.priceType === 'FOR_EACH'
            ? listing.price * BigInt(c.spots)
            : listing.price,
        // Set by the middleman when terms are proposed — computed, not entered.
        mmFee: 0n,
        collateralAmount: listing.collateral,
        asset: listing.payment,
        quantity: c.spots,
        specific: listing.specific,
        priceType: listing.priceType,
      },
    });

    await db.transactionLog.create({
      data: {
        dealId: deal.id,
        actorId: ids[c.buyer],
        action: 'DEAL_CREATED',
        toStatus: 'OPEN',
        metadata: { via: 'seed', listingId, spots: c.spots },
      },
    });

    batch += 1;
  }
  console.log(`  ${competing.length} competing deals across 3 listings`);

  // Completed deals so the roster shows real vouch counts.
  const closed = [
    { mm: 'akla', project: 'Halcyon Days' },
    { mm: 'akla', project: 'Nocturne' },
    { mm: 'rei', project: 'Meridian' },
    { mm: 'nadia', project: 'Vellum' },
    { mm: 'sable', project: 'Static Bloom' },
    { mm: 'sable', project: 'Gradient Club' },
    { mm: 'juno', project: 'Paper Lanterns' },
  ];

  for (const c of closed) {
    const deal = await db.deal.create({
      data: {
        reference: `${String(batch).padStart(2, '0')}-DONE-${c.project.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10)}`,
        batchNumber: batch,
        buyerId: ids.buyer_one,
        sellerId: ids.seller_one,
        middlemanId: ids[c.mm],
        method: 'OTC',
        status: 'COMPLETED',
        projectName: c.project,
        chain: 'Solana',
        dealAmount: usd(45),
        mmFee: usd(5),
        asset: 'USDC',
        quantity: 1,
        specific: 'GTD',
        priceType: 'FOR_ALL',
        termsLockedAt: new Date(),
        fundedAt: new Date(),
        completedAt: new Date(),
      },
    });

    await db.transactionLog.create({
      data: {
        dealId: deal.id,
        actorId: ids[c.mm],
        action: 'FUNDS_RELEASED',
        amount: usd(45),
        asset: 'USDC',
        fromStatus: 'AWAITING_CONFIRMATION',
        toStatus: 'COMPLETED',
      },
    });

    await db.vouch.create({
      data: {
        dealId: deal.id,
        authorId: ids.buyer_one,
        middlemanId: ids[c.mm],
        body: 'Fast and clear throughout. Confirmed both payments within minutes.',
      },
    });

    batch += 1;
  }
  console.log(`  ${closed.length} completed deals with vouches`);

  console.log('\ndemo accounts (all share one password):');
  for (const p of PEOPLE) {
    const shift = p.workingHoursUtc ? `  ${p.workingHoursUtc}` : '';
    console.log(`  ${p.email.padEnd(28)} ${p.role.padEnd(16)}${shift}`);
  }
  console.log(`  password: ${PASSWORD}`);
  console.log('\nThese are demo accounts. No real users, no real funds.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
