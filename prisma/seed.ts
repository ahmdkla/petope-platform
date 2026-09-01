/**
 * Demo seed. Run by `prisma migrate reset`.
 *
 * Users are created through Better Auth's server API rather than by inserting
 * rows directly — that is the only way the stored password is a real scrypt
 * hash that will actually sign in. Domain fields are patched on afterwards.
 *
 * Everything here is `isTest: false` on purpose. This is demo data meant to be
 * seen: it populates the marketplace, the roster, the vouch feed and the admin
 * queues. Test debris is what `isTest: true` is for, and the suites in
 * `scripts/` set it themselves.
 */
import 'dotenv/config';
import { auth } from '../lib/auth';
import { db } from '../lib/db';
import { BLACKLISTED } from './blacklist-cases';
import type {
  ListingSide,
  ListingType,
  PaymentAsset,
  PriceType,
  SpotType,
} from '@prisma/client';

const PASSWORD = 'Exsaverse789';

/**
 * Money is stored in the asset's SMALLEST UNIT, never as a display number.
 * USDC/USDT have 6 decimals, SOL has 9. Writing `1500n` for "$15" would store
 * $0.0015 — these helpers exist so that mistake is impossible here.
 */
const usd = (n: number) => BigInt(Math.round(n * 1_000_000));
const sol = (n: number) => BigInt(Math.round(n * 1_000_000_000));

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);
const ahead = (ms: number) => new Date(now + ms);

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
  /** What this account is for, printed with the credentials at the end. */
  purpose: string;
  workingHoursUtc?: string;
  tradesSecured?: number;
};

const PEOPLE: Seed[] = [
  // --- the escrow team ---------------------------------------------------
  { email: 'akla@exsaverse.demo', displayName: 'akla', role: 'MAIN_MIDDLEMAN', purpose: 'boss MM — final say on disputes', workingHoursUtc: SHIFTS.night, tradesSecured: 4820 },
  { email: 'rei@exsaverse.demo', displayName: 'rei', role: 'MIDDLEMAN', purpose: 'night shift', workingHoursUtc: SHIFTS.night, tradesSecured: 1960 },
  { email: 'nadia@exsaverse.demo', displayName: 'nadia', role: 'MIDDLEMAN', purpose: 'day shift', workingHoursUtc: SHIFTS.day, tradesSecured: 3140 },
  { email: 'juno@exsaverse.demo', displayName: 'juno', role: 'MIDDLEMAN', purpose: 'day shift', workingHoursUtc: SHIFTS.day, tradesSecured: 774 },
  { email: 'sable@exsaverse.demo', displayName: 'sable', role: 'MIDDLEMAN', purpose: 'evening shift', workingHoursUtc: SHIFTS.evening, tradesSecured: 2255 },
  // The newest middleman, kept on the roster with a low trade count: being
  // listed is the whole verification, so there is no lesser tier to sit in.
  { email: 'tobi@exsaverse.demo', displayName: 'tobi', role: 'MIDDLEMAN', purpose: 'evening shift — newest, lowest trade count', workingHoursUtc: SHIFTS.evening, tradesSecured: 31 },

  { email: 'admin@exsaverse.demo', displayName: 'admin', role: 'ADMIN', purpose: 'admin section, fee config, blacklist' },

  // --- the named cast ----------------------------------------------------
  { email: 'kairo@exsaverse.demo', displayName: 'kairo', role: 'USER', purpose: 'buyer — 2 BUY listings, deals in 4 states' },
  { email: 'mirae@exsaverse.demo', displayName: 'mirae', role: 'USER', purpose: 'buyer — 2 BUY listings, deals in 4 states' },
  { email: 'dax@exsaverse.demo', displayName: 'dax', role: 'USER', purpose: 'seller — 2 SELL listings' },
  { email: 'lumi@exsaverse.demo', displayName: 'lumi', role: 'USER', purpose: 'seller — 2 SELL listings' },

  // --- background traders ------------------------------------------------
  // The 25 marketplace listings belong to these three, so the board stays
  // populated with listings you do NOT own whoever you sign in as.
  { email: 'vex@exsaverse.demo', displayName: 'vex', role: 'USER', purpose: 'background trader — owns marketplace listings' },
  { email: 'nori@exsaverse.demo', displayName: 'nori', role: 'USER', purpose: 'background trader — owns marketplace listings' },
  { email: 'quill@exsaverse.demo', displayName: 'quill', role: 'USER', purpose: 'background trader — owns marketplace listings' },

  // Upheld report target, blacklisted below so /blacklist has a real entry.
  // --- blacklisted -------------------------------------------------------
  // Seven upheld cases, so /blacklist and /admin/reports both have a real
  // spread to show. Each one is blacklisted by an upheld report below, never
  // by hand: the page promises every entry was reviewed first.
  { email: 'dredge@exsaverse.demo', displayName: 'dredge', role: 'USER', purpose: 'BLACKLISTED — cannot sign in, shown on /blacklist' },
  { email: 'vexnode@exsaverse.demo', displayName: 'vexnode', role: 'USER', purpose: 'BLACKLISTED' },
  { email: 'mirrorsmm@exsaverse.demo', displayName: 'mirrors_mm', role: 'USER', purpose: 'BLACKLISTED' },
  { email: 'nullkey@exsaverse.demo', displayName: 'nullkey', role: 'USER', purpose: 'BLACKLISTED' },
  { email: 'redredge@exsaverse.demo', displayName: 'dredge_2', role: 'USER', purpose: 'BLACKLISTED' },
  { email: 'slipmint@exsaverse.demo', displayName: 'slipmint', role: 'USER', purpose: 'BLACKLISTED' },
  { email: 'coldhandle@exsaverse.demo', displayName: 'coldhandle', role: 'USER', purpose: 'BLACKLISTED' },
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

/** The named cast's own listings: two each, on the side their role implies. */
const CAST_LISTINGS: ListingSeed[] = [
  { side: 'SELL', author: 'dax', item: 'Ashfall Syndicate', chain: 'Solana', price: usd(26), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 6, remaining: 4, collateral: usd(13), acceptsOffers: true, promoted: true, projectLink: 'https://x.com/ashfall' },
  { side: 'SELL', author: 'dax', item: 'Kite Season', chain: 'Base', price: sol(0.75), priceType: 'FOR_EACH', payment: 'SOL', specific: 'FCFS', type: 'MINT', quantity: 10, remaining: 7, collateral: sol(0.4) },
  { side: 'SELL', author: 'lumi', item: 'Verdant Hours', chain: 'Ethereum', price: usd(55), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SURRENDER', quantity: 3, remaining: 2, collateral: usd(28), acceptsOffers: true },
  { side: 'SELL', author: 'lumi', item: 'Signal Garden', chain: 'Solana', price: usd(80), priceType: 'FOR_ALL', payment: 'STABLE', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 4, collateral: usd(30) },

  { side: 'BUY', author: 'kairo', item: 'Ashfall Syndicate', chain: 'Solana', price: usd(21), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'ANY', quantity: 3, acceptsOffers: true },
  { side: 'BUY', author: 'kairo', item: 'Ordinal Row', chain: 'Ethereum', price: usd(95), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 1 },
  { side: 'BUY', author: 'mirae', item: 'Verdant Hours', chain: 'Ethereum', price: usd(48), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'ANY', quantity: 2, acceptsOffers: true },
  { side: 'BUY', author: 'mirae', item: 'Kite Season', chain: 'Base', price: sol(0.6), priceType: 'FOR_EACH', payment: 'SOL', specific: 'FCFS', type: 'MINT', quantity: 5 },
];

/** 25 background listings, so the board is full whoever is signed in. */
const MARKET_LISTINGS: ListingSeed[] = [
  { side: 'SELL', author: 'vex', item: 'Fabled Genesis', chain: 'Solana', price: usd(15), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 8, remaining: 5, collateral: usd(7), acceptsOffers: true, promoted: true, projectLink: 'https://x.com/fabled' },
  { side: 'SELL', author: 'nori', item: 'Solstice Pass', chain: 'Solana', price: usd(22), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'MINT', quantity: 4, collateral: usd(12), acceptsOffers: true },
  { side: 'SELL', author: 'vex', item: 'Cryptid Society', chain: 'Solana', price: sol(0.45), priceType: 'FOR_EACH', payment: 'SOL', specific: 'FCFS', type: 'WALLET_SURRENDER', quantity: 6, remaining: 2, collateral: sol(0.3) },
  { side: 'SELL', author: 'quill', item: 'Lumen Protocol', chain: 'Solana', price: usd(9), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'FCFS', type: 'ANY', quantity: 12 },
  { side: 'SELL', author: 'nori', item: 'Halcyon Days', chain: 'Solana', price: usd(60), priceType: 'FOR_ALL', payment: 'STABLE', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 3, collateral: usd(20), acceptsOffers: true },
  { side: 'SELL', author: 'quill', item: 'Nocturne', chain: 'Solana', price: usd(18), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 5, remaining: 0, collateral: usd(9) },
  { side: 'SELL', author: 'vex', item: 'Tidal Drift', chain: 'Solana', price: sol(1.2), priceType: 'FOR_EACH', payment: 'SOL', specific: 'GTD', type: 'MINT', quantity: 2, collateral: sol(0.8) },
  { side: 'SELL', author: 'nori', item: 'Paper Lanterns', chain: 'Solana', price: usd(11), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'FCFS', type: 'ANY', quantity: 20, remaining: 14, acceptsOffers: true },
  { side: 'SELL', author: 'quill', item: 'Northlake', chain: 'Base', price: usd(40), priceType: 'FOR_ALL', payment: 'STABLE', specific: 'FCFS', type: 'MINT', quantity: 5, collateral: usd(12), acceptsOffers: true },
  { side: 'SELL', author: 'vex', item: 'Basecamp Founders', chain: 'Base', price: usd(35), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 3, remaining: 1, collateral: usd(15), promoted: true },
  { side: 'SELL', author: 'nori', item: 'Onchain Summer', chain: 'Base', price: usd(7), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'FCFS', type: 'ANY', quantity: 25, remaining: 18 },
  { side: 'SELL', author: 'quill', item: 'Meridian', chain: 'Base', price: usd(28), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SURRENDER', quantity: 4, collateral: usd(14), acceptsOffers: true },
  { side: 'SELL', author: 'vex', item: 'Gradient Club', chain: 'Base', price: usd(50), priceType: 'FOR_ALL', payment: 'STABLE', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 2 },
  { side: 'SELL', author: 'nori', item: 'Aster Pass', chain: 'Ethereum', price: sol(0.9), priceType: 'FOR_EACH', payment: 'SOL', specific: 'GTD', type: 'MINT', quantity: 3, remaining: 2, collateral: sol(0.5), acceptsOffers: true },
  { side: 'SELL', author: 'quill', item: 'Ordinal Row', chain: 'Ethereum', price: usd(120), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 2, collateral: usd(60) },
  { side: 'SELL', author: 'vex', item: 'Vellum', chain: 'Ethereum', price: usd(45), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'FCFS', type: 'ANY', quantity: 6, remaining: 3 },
  { side: 'SELL', author: 'nori', item: 'Static Bloom', chain: 'Ethereum', price: usd(30), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SURRENDER', quantity: 4, collateral: usd(18), acceptsOffers: true },
  { side: 'SELL', author: 'quill', item: 'Reverie', chain: 'Robinhood', price: usd(9), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 3, remaining: 1 },
  { side: 'BUY', author: 'vex', item: 'Fabled Genesis', chain: 'Solana', price: usd(13), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'ANY', quantity: 2, acceptsOffers: true },
  { side: 'BUY', author: 'nori', item: 'Solstice Pass', chain: 'Solana', price: usd(20), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'MINT', quantity: 1 },
  { side: 'BUY', author: 'quill', item: 'Basecamp Founders', chain: 'Base', price: usd(32), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'GTD', type: 'WALLET_SUBMIT', quantity: 3, acceptsOffers: true },
  { side: 'BUY', author: 'vex', item: 'Onchain Summer', chain: 'Base', price: usd(6), priceType: 'FOR_EACH', payment: 'STABLE', specific: 'FCFS', type: 'ANY', quantity: 10 },
  { side: 'BUY', author: 'nori', item: 'Tidal Drift', chain: 'Solana', price: sol(1), priceType: 'FOR_EACH', payment: 'SOL', specific: 'GTD', type: 'MINT', quantity: 2 },
  { side: 'BUY', author: 'quill', item: 'Meridian', chain: 'Base', price: usd(25), priceType: 'FOR_ALL', payment: 'STABLE', specific: 'GTD', type: 'ANY', quantity: 2, acceptsOffers: true },
  { side: 'BUY', author: 'vex', item: 'Signal Garden', chain: 'Solana', price: usd(70), priceType: 'FOR_ALL', payment: 'STABLE', specific: 'GTD', type: 'TOKEN_TRANSFER', quantity: 4 },
];

const LISTINGS = [...CAST_LISTINGS, ...MARKET_LISTINGS];

async function main() {
  console.log('seeding demo data...\n');

  const ids: Record<string, string> = {};

  for (const p of PEOPLE) {
    const res = await auth.api.signUpEmail({
      body: { email: p.email, password: PASSWORD, name: p.displayName },
    });
    ids[p.displayName] = res.user.id;

    await db.user.update({
      where: { id: res.user.id },
      data: {
        role: p.role,
        workingHoursUtc: p.workingHoursUtc ?? null,
        tradesSecured: p.tradesSecured ?? 0,
        emailVerified: true, // demo accounts; no mail provider is wired up
        termsAcceptedAt: new Date(),
      },
    });
  }
  console.log(`  ${PEOPLE.length} accounts`);

  // Admin-tunable values — never hardcoded in logic.
  await db.adminSetting.createMany({
    data: [
      {
        key: 'collateral.minimum',
        value: { amount: 5_000_000, asset: 'STABLE', note: 'smallest unit = $5.00 in USDC or USDT' },
        description: 'Minimum seller collateral, all methods.',
        updatedById: ids.admin,
      },
      {
        key: 'mmFee.config',
        value: {
          percentBasisPoints: 500,
          floor: { STABLE: 5_000_000, SOL: 30_000_000 },
          refundWindowHours: 24,
          note: 'fee = max(floor, (dealAmount + collateral) * 5%). One floor per settlement asset in smallest units. USDC and USDT share the STABLE floor. There is no price feed, so the SOL floor is set by hand and drifts as SOL moves.',
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
        promotedUntil: l.promoted ? ahead(14 * DAY) : null,
        projectLink: l.projectLink ?? null,
        isTest: false,
        // Zero remaining is sold out; it stays in the feed, it just takes no
        // new deals.
        status: remaining <= 0 ? 'SOLD_OUT' : 'ACTIVE',
      },
    });
    listingIds[`${l.side}:${l.item}:${l.author}`] = created.id;
  }
  console.log(`  ${LISTINGS.length} listings (${CAST_LISTINGS.length} owned by the named cast)`);

  // --- mint schedule -------------------------------------------------------
  // Some ahead, some behind, so /mints has both an upcoming list and a history.
  const mintSeeds = [
    { projectName: 'Ashfall Syndicate', chain: 'Solana', mintAt: ahead(3 * DAY), note: 'Allowlist closes 12h before mint.' },
    { projectName: 'Kite Season', chain: 'Base', mintAt: ahead(9 * DAY), note: null },
    { projectName: 'Verdant Hours', chain: 'Ethereum', mintAt: ahead(16 * DAY), note: 'Team has flagged a possible one-week slip.' },
    { projectName: 'Basecamp Founders', chain: 'Base', mintAt: ago(6 * DAY), note: null },
    { projectName: 'Nocturne', chain: 'Solana', mintAt: ago(21 * DAY), note: 'Minted out in under four minutes.' },
  ];
  const mintIds: Record<string, string> = {};
  for (const m of mintSeeds) {
    const created = await db.mintEvent.create({
      data: { ...m, createdById: ids.nadia, projectLink: null },
    });
    mintIds[m.projectName] = created.id;
  }
  console.log(`  ${mintSeeds.length} mint events (3 upcoming, 2 past)`);

  // --- deals ---------------------------------------------------------------
  // The fee is derived exactly as the server derives it: it is never a number
  // typed into seed data. base = dealAmount + collateral, fee = max(floor, 5%).
  const feeFor = (amount: bigint, collateral: bigint, asset: PaymentAsset) => {
    const floor = asset === 'SOL' ? sol(0.03) : usd(5);
    const percent = ((amount + collateral) * 500n) / 10_000n;
    return percent > floor ? percent : floor;
  };

  let batch = 100;
  const dealIds: Record<string, string> = {};

  async function createDeal(opts: {
    key: string;
    buyer: string;
    seller: string;
    mm: string | null;
    project: string;
    chain: string;
    listingKey?: string;
    method?: 'WALLET_SUBMIT' | 'WALLET_SURRENDER' | 'MINT_FOR_YOU' | 'OTC' | 'DISCORD_SURRENDER';
    status: 'OPEN' | 'AWAITING_PAYMENT' | 'FUNDED' | 'AWAITING_MINT' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED';
    amount: bigint;
    collateral?: bigint;
    asset: PaymentAsset;
    quantity?: number;
    specific?: SpotType;
    mintEvent?: string;
    stamps?: Record<string, Date | null>;
    escalationReason?: string;
  }) {
    batch += 1;
    const collateral = opts.collateral ?? 0n;
    const mmFee = opts.mm ? feeFor(opts.amount, collateral, opts.asset) : 0n;
    const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

    const deal = await db.deal.create({
      data: {
        reference: `${batch}-${clean(opts.buyer)}-${clean(opts.project).slice(0, 12)}`,
        batchNumber: batch,
        listingId: opts.listingKey ? (listingIds[opts.listingKey] ?? null) : null,
        buyerId: ids[opts.buyer],
        sellerId: ids[opts.seller],
        middlemanId: opts.mm ? ids[opts.mm] : null,
        method: opts.method ?? null,
        status: opts.status,
        projectName: opts.project,
        chain: opts.chain,
        dealAmount: opts.amount,
        mmFee,
        collateralAmount: collateral > 0n ? collateral : null,
        asset: opts.asset,
        quantity: opts.quantity ?? 1,
        specific: opts.specific ?? 'GTD',
        priceType: 'FOR_EACH',
        mintEventId: opts.mintEvent ? mintIds[opts.mintEvent] : null,
        mintAt: opts.mintEvent ? mintSeeds.find((m) => m.projectName === opts.mintEvent)?.mintAt : null,
        escalationReason: opts.escalationReason ?? null,
        escalatedById: opts.escalationReason ? ids[opts.buyer] : null,
        escalatedAt: opts.escalationReason ? ago(2 * HOUR) : null,
        isTest: false,
        ...opts.stamps,
      },
    });
    dealIds[opts.key] = deal.id;
    return deal;
  }

  /** Ledger row + the system message the deal room shows for the same event. */
  async function log(
    dealKey: string,
    actor: string,
    action: 'DEAL_CREATED' | 'DEAL_CLAIMED' | 'TERMS_LOCKED' | 'PAYMENT_REQUESTED' | 'PROOF_SUBMITTED' | 'PROOF_CONFIRMED' | 'DEAL_FUNDED' | 'FUNDS_RELEASED' | 'REFUND_ISSUED' | 'DEAL_ESCALATED' | 'MM_FEE_TAKEN' | 'COLLATERAL_RETURNED',
    body: string,
    extra: { amount?: bigint; asset?: PaymentAsset; at?: Date } = {},
  ) {
    await db.transactionLog.create({
      data: {
        dealId: dealIds[dealKey],
        actorId: ids[actor],
        action,
        amount: extra.amount ?? null,
        asset: extra.asset ?? null,
        metadata: { via: 'seed' },
      },
    });
    await db.dealMessage.create({
      data: {
        dealId: dealIds[dealKey],
        authorId: null,
        kind: 'SYSTEM',
        body,
        createdAt: extra.at ?? new Date(),
      },
    });
  }

  /**
   * A proof is a human's claim until a middleman opens the link and confirms it.
   * `verifiedById` is always a different person from `submittedById` — the
   * database CHECK refuses self-verification, and so does the service layer.
   */
  async function proof(opts: {
    dealKey: string;
    kind: 'BUYER_PAYMENT' | 'SELLER_COLLATERAL' | 'MM_RELEASE' | 'MM_REFUND';
    by: string;
    reference: string;
    amount: bigint;
    coin: PaymentAsset;
    confirmedBy?: string;
    note?: string;
  }) {
    await db.paymentProof.create({
      data: {
        dealId: dealIds[opts.dealKey],
        kind: opts.kind,
        submittedById: ids[opts.by],
        submittedAt: ago(5 * HOUR),
        reference: opts.reference,
        claimedAmount: opts.amount,
        claimedAsset: opts.coin,
        status: opts.confirmedBy ? 'CONFIRMED' : 'SUBMITTED',
        verifiedById: opts.confirmedBy ? ids[opts.confirmedBy] : null,
        verifiedAt: opts.confirmedBy ? ago(4 * HOUR) : null,
        verifierNote: opts.note ?? null,
      },
    });
  }

  // 1. OPEN — no middleman yet, so it sits in the unclaimed queue.
  await createDeal({
    key: 'open', buyer: 'kairo', seller: 'dax', mm: null,
    project: 'Ashfall Syndicate', chain: 'Solana',
    listingKey: 'SELL:Ashfall Syndicate:dax',
    status: 'OPEN', amount: usd(52), collateral: usd(13), asset: 'STABLE',
    quantity: 2,
  });
  await log('open', 'kairo', 'DEAL_CREATED', 'Deal opened. Waiting for a middleman to claim it and join the room.');

  // 2. AWAITING_PAYMENT — one proof in, unverified. It advances nothing.
  await createDeal({
    key: 'awaiting', buyer: 'mirae', seller: 'lumi', mm: 'nadia',
    project: 'Verdant Hours', chain: 'Ethereum',
    listingKey: 'SELL:Verdant Hours:lumi',
    method: 'WALLET_SURRENDER', status: 'AWAITING_PAYMENT',
    amount: usd(110), collateral: usd(28), asset: 'STABLE', quantity: 2,
    mintEvent: 'Verdant Hours',
    stamps: { claimedAt: ago(2 * DAY), termsLockedAt: ago(30 * HOUR) },
  });
  await log('awaiting', 'nadia', 'DEAL_CLAIMED', 'nadia claimed this deal and joined the room.', { at: ago(2 * DAY) });
  await log('awaiting', 'nadia', 'TERMS_LOCKED', 'Both parties confirmed Wallet Surrender. Terms are locked.', { at: ago(30 * HOUR) });
  await log('awaiting', 'nadia', 'PAYMENT_REQUESTED', 'Payment window opened. The buyer sends the deal amount plus the MM fee; the seller sends collateral.', { at: ago(29 * HOUR) });
  await proof({
    dealKey: 'awaiting', kind: 'BUYER_PAYMENT', by: 'mirae',
    reference: 'https://solscan.io/tx/5xQe5vLmDEMOawaitingBuyerPayment8823',
    amount: usd(116.9), coin: 'USDC',
  });
  await log('awaiting', 'mirae', 'PROOF_SUBMITTED', 'A payment proof was submitted for review. It changes nothing until the middleman opens the link and confirms it.');

  // 3. FUNDED — both proofs confirmed by the assigned middleman, spots reserved.
  await createDeal({
    key: 'funded', buyer: 'kairo', seller: 'lumi', mm: 'rei',
    project: 'Signal Garden', chain: 'Solana',
    listingKey: 'SELL:Signal Garden:lumi',
    method: 'WALLET_SUBMIT', status: 'FUNDED',
    amount: usd(80), collateral: usd(30), asset: 'STABLE', quantity: 1,
    stamps: {
      claimedAt: ago(3 * DAY), termsLockedAt: ago(2 * DAY),
      fundedAt: ago(20 * HOUR), spotsReservedAt: ago(20 * HOUR),
    },
  });
  await log('funded', 'rei', 'DEAL_CLAIMED', 'rei claimed this deal and joined the room.', { at: ago(3 * DAY) });
  await log('funded', 'rei', 'TERMS_LOCKED', 'Both parties confirmed Wallet Submit. Terms are locked.', { at: ago(2 * DAY) });
  await proof({
    dealKey: 'funded', kind: 'BUYER_PAYMENT', by: 'kairo',
    reference: 'https://solscan.io/tx/3kTn9wDEMOfundedBuyerPayment41182',
    amount: usd(85.5), coin: 'USDC', confirmedBy: 'rei',
    note: 'Opened the link. Amount and destination match the terms.',
  });
  await proof({
    dealKey: 'funded', kind: 'SELLER_COLLATERAL', by: 'lumi',
    reference: 'https://solscan.io/tx/7bVc2pDEMOfundedCollateral90277',
    amount: usd(30), coin: 'USDT', confirmedBy: 'rei',
    note: 'Collateral received in full.',
  });
  await log('funded', 'rei', 'PROOF_CONFIRMED', 'The middleman opened the reference, checked it personally, and confirmed the payment.', { amount: usd(85.5), asset: 'USDC' });
  await log('funded', 'rei', 'DEAL_FUNDED', 'Both payments are confirmed. Spots are now reserved on the listing.', { at: ago(20 * HOUR) });

  // 4. AWAITING_MINT — the long wait. Deals sit here for weeks; that is normal.
  await createDeal({
    key: 'mint', buyer: 'mirae', seller: 'dax', mm: 'sable',
    project: 'Kite Season', chain: 'Base',
    listingKey: 'SELL:Kite Season:dax',
    method: 'MINT_FOR_YOU', status: 'AWAITING_MINT',
    amount: sol(2.25), collateral: sol(0.4), asset: 'SOL', quantity: 3,
    specific: 'FCFS', mintEvent: 'Kite Season',
    stamps: {
      claimedAt: ago(6 * DAY), termsLockedAt: ago(6 * DAY),
      fundedAt: ago(5 * DAY), spotsReservedAt: ago(5 * DAY),
      handoverDeclaredByBuyerAt: ago(4 * DAY),
      handoverDeclaredBySellerAt: ago(4 * DAY),
    },
  });
  await log('mint', 'sable', 'DEAL_FUNDED', 'Both payments are confirmed. Waiting on the project mint.', { at: ago(5 * DAY) });
  await proof({
    dealKey: 'mint', kind: 'BUYER_PAYMENT', by: 'mirae',
    reference: 'https://solscan.io/tx/9wRk4mDEMOmintBuyerPayment55310',
    amount: sol(2.4), coin: 'SOL', confirmedBy: 'sable',
    note: 'Confirmed on chain by eye. Amount matches deal plus fee.',
  });
  await proof({
    dealKey: 'mint', kind: 'SELLER_COLLATERAL', by: 'dax',
    reference: 'https://solscan.io/tx/2gHf8sDEMOmintCollateral71904',
    amount: sol(0.4), coin: 'SOL', confirmedBy: 'sable',
  });

  // 5. COMPLETED — the vouch feed and the roster's trade counts come from these.
  const completed = [
    { key: 'done1', buyer: 'kairo', seller: 'dax', mm: 'akla', project: 'Basecamp Founders', chain: 'Base', amount: usd(70), collateral: usd(15), mintEvent: 'Basecamp Founders', body: 'Held the funds through a two-week mint delay without a single chase from me. Released the same hour I confirmed.' },
    { key: 'done2', buyer: 'mirae', seller: 'lumi', mm: 'rei', project: 'Nocturne', chain: 'Solana', amount: usd(36), collateral: usd(9), mintEvent: 'Nocturne', body: 'Checked both Solscan links himself and said exactly what he was looking at. No guesswork.' },
    { key: 'done3', buyer: 'kairo', seller: 'lumi', mm: 'nadia', project: 'Halcyon Days', chain: 'Solana', amount: usd(60), collateral: usd(20), mintEvent: undefined, body: 'Seller went quiet for six hours and nadia kept the room updated the whole time. Collateral came back clean.' },
    { key: 'done4', buyer: 'mirae', seller: 'dax', mm: 'sable', project: 'Static Bloom', chain: 'Ethereum', amount: usd(120), collateral: usd(18), mintEvent: undefined, body: 'Biggest deal I have run here. Every step was written down in the room before it happened.' },
    { key: 'done5', buyer: 'kairo', seller: 'dax', mm: 'juno', project: 'Paper Lanterns', chain: 'Solana', amount: usd(22), collateral: usd(0), mintEvent: undefined, body: 'Small deal, same care as a big one.' },
  ];

  for (const c of completed) {
    await createDeal({
      key: c.key, buyer: c.buyer, seller: c.seller, mm: c.mm,
      project: c.project, chain: c.chain, method: 'OTC', status: 'COMPLETED',
      amount: c.amount, collateral: c.collateral, asset: 'STABLE',
      mintEvent: c.mintEvent,
      stamps: {
        claimedAt: ago(12 * DAY), termsLockedAt: ago(11 * DAY),
        fundedAt: ago(10 * DAY), spotsReservedAt: ago(10 * DAY),
        receiptConfirmedAt: ago(8 * DAY), completedAt: ago(8 * DAY),
      },
    });
    await proof({
      dealKey: c.key, kind: 'BUYER_PAYMENT', by: c.buyer,
      reference: `https://solscan.io/tx/DEMO${c.key.toUpperCase()}BUYERPAYMENT`,
      amount: c.amount, coin: 'USDC', confirmedBy: c.mm,
      note: 'Verified personally before release.',
    });
    await log(c.key, c.mm, 'FUNDS_RELEASED', 'The middleman released the funds to the seller and posted the payout reference.', { amount: c.amount, asset: 'USDC', at: ago(8 * DAY) });
    await log(c.key, c.mm, 'MM_FEE_TAKEN', 'The MM fee was taken from the escrowed amount.', { at: ago(8 * DAY) });

    await db.vouch.create({
      data: {
        dealId: dealIds[c.key],
        authorId: ids[c.buyer],
        middlemanId: ids[c.mm],
        body: c.body,
        createdAt: ago(7 * DAY),
      },
    });
  }
  console.log(`  ${completed.length} completed deals, each with a vouch`);

  // 6. DISPUTED — sits in the admin queue with both sides on record.
  await createDeal({
    key: 'disputed', buyer: 'kairo', seller: 'lumi', mm: 'juno',
    project: 'Ordinal Row', chain: 'Ethereum',
    method: 'WALLET_SUBMIT', status: 'DISPUTED',
    amount: usd(120), collateral: usd(60), asset: 'STABLE',
    escalationReason:
      'Seller says the wallet was submitted before the allowlist closed. Buyer says the wallet never appeared on the published list and has a screenshot of the closed form.',
    stamps: {
      claimedAt: ago(9 * DAY), termsLockedAt: ago(9 * DAY),
      fundedAt: ago(8 * DAY), spotsReservedAt: ago(8 * DAY),
      timersPausedAt: ago(2 * HOUR),
    },
  });
  await log('disputed', 'juno', 'DEAL_FUNDED', 'Both payments are confirmed.', { at: ago(8 * DAY) });
  await log('disputed', 'kairo', 'DEAL_ESCALATED', 'The deal was escalated to the middleman team. Release timers are paused while it is reviewed.', { at: ago(2 * HOUR) });
  await proof({
    dealKey: 'disputed', kind: 'BUYER_PAYMENT', by: 'kairo',
    reference: 'https://solscan.io/tx/DEMOdisputedBuyerPayment66120',
    amount: usd(126), coin: 'USDC', confirmedBy: 'juno',
  });
  await proof({
    dealKey: 'disputed', kind: 'SELLER_COLLATERAL', by: 'lumi',
    reference: 'https://solscan.io/tx/DEMOdisputedCollateral33481',
    amount: usd(60), coin: 'USDC', confirmedBy: 'juno',
  });

  // 7. REFUNDED — buyer made whole. The MM fee is NOT reversed by this path.
  await createDeal({
    key: 'refunded', buyer: 'mirae', seller: 'dax', mm: 'tobi',
    project: 'Tidal Drift', chain: 'Solana',
    method: 'MINT_FOR_YOU', status: 'REFUNDED',
    amount: sol(1.2), collateral: sol(0.8), asset: 'SOL',
    stamps: {
      claimedAt: ago(15 * DAY), termsLockedAt: ago(15 * DAY),
      fundedAt: ago(14 * DAY), cancelledAt: null,
    },
  });
  await log('refunded', 'tobi', 'REFUND_ISSUED', 'The seller missed the six-hour delivery window after mint. The buyer was refunded in full and the collateral was forfeited to them.', { amount: sol(1.2), asset: 'SOL', at: ago(13 * DAY) });
  await proof({
    dealKey: 'refunded', kind: 'MM_REFUND', by: 'tobi',
    reference: 'https://solscan.io/tx/DEMOrefundPayout20934',
    amount: sol(2), coin: 'SOL',
  });
  console.log('  1 open, 1 awaiting payment, 1 funded, 1 awaiting mint, 1 disputed, 1 refunded');

  // --- support -------------------------------------------------------------
  const openTicket = await db.supportTicket.create({
    data: {
      reference: 'SUP-1041',
      openedById: ids.kairo,
      category: 'GENERAL_HELP',
      subject: 'How long does a deal normally sit in awaiting mint?',
      status: 'OPEN',
      createdAt: ago(4 * HOUR),
    },
  });
  await db.supportMessage.createMany({
    data: [
      { ticketId: openTicket.id, authorId: null, kind: 'SYSTEM', body: 'Support room opened. Any middleman or admin can pick this up.' },
      { ticketId: openTicket.id, authorId: ids.kairo, kind: 'USER', body: 'My Kite Season deal has been in awaiting mint for six days. Is that normal or has something stalled?' },
    ],
  });

  const assignedTicket = await db.supportTicket.create({
    data: {
      reference: 'SUP-1042',
      openedById: ids.mirae,
      category: 'ADS_PREMIUM',
      subject: 'Promoting a listing for a week',
      status: 'ASSIGNED',
      assignedToId: ids.nadia,
      createdAt: ago(2 * DAY),
    },
  });
  await db.supportMessage.createMany({
    data: [
      { ticketId: assignedTicket.id, authorId: null, kind: 'SYSTEM', body: 'Support room opened. Any middleman or admin can pick this up.' },
      { ticketId: assignedTicket.id, authorId: ids.mirae, kind: 'USER', body: 'What does a promoted slot cost for seven days, and can I pay in SOL?' },
      { ticketId: assignedTicket.id, authorId: null, kind: 'SYSTEM', body: 'nadia was assigned to this room.' },
      { ticketId: assignedTicket.id, authorId: ids.nadia, kind: 'USER', body: 'Taking this one. Sending you the current rates now — SOL and stables are both fine.' },
    ],
  });
  console.log('  2 support tickets (1 open, 1 assigned)');

  // --- scammer reports -----------------------------------------------------
  // Pending reports are private to the reporter and the review team. Naming
  // someone before review would make the platform the publisher of an
  // unverified accusation.
  await db.scammerReport.create({
    data: {
      reporterId: ids.mirae,
      accusedUserId: null,
      accusedHandle: 'akla_support',
      category: 'DM_IMPERSONATION',
      evidence:
        'Account with a copied avatar and a near-identical handle messaged me first on Discord claiming to be the middleman for my deal, and asked me to send the collateral to a different wallet. The real middleman confirmed in the room that it was not them.',
      evidenceUrl: 'https://example.invalid/demo-screenshot-impersonation',
      status: 'PENDING',
      createdAt: ago(6 * HOUR),
    },
  });

  for (const c of BLACKLISTED) {
    const target = ids[c.handle];
    await db.scammerReport.create({
      data: {
        reporterId: ids[c.reporter],
        accusedUserId: target,
        accusedHandle: c.handle,
        category: c.category,
        evidence: c.evidence,
        status: 'UPHELD',
        reviewedById: ids.admin,
        reviewedAt: ago(c.daysAgo * DAY),
        reviewNote: c.note,
        createdAt: ago((c.daysAgo + 2) * DAY),
      },
    });

    await db.user.update({
      where: { id: target },
      data: {
        status: 'BLACKLISTED',
        blacklistReason: c.reason,
        blacklistedAt: ago(c.daysAgo * DAY),
        blacklistedById: ids.admin,
      },
    });
  }
  console.log(
    `  ${BLACKLISTED.length + 1} scammer reports (1 pending, ${BLACKLISTED.length} upheld -> ${BLACKLISTED.length} blacklisted accounts)`,
  );

  // --- credentials ---------------------------------------------------------
  const w = Math.max(...PEOPLE.map((p) => p.email.length));
  console.log('\n' + '-'.repeat(w + 46));
  console.log('DEMO ACCOUNTS'.padEnd(w + 2) + 'ROLE'.padEnd(16) + 'PASSWORD');
  console.log('-'.repeat(w + 46));
  for (const p of PEOPLE) {
    console.log(
      `${p.email.padEnd(w + 2)}${p.role.padEnd(16)}${PASSWORD.padEnd(14)}${p.purpose}`,
    );
  }
  console.log('-'.repeat(w + 46));
  console.log(`\nEvery account uses the same password: ${PASSWORD}`);
  console.log('The BLACKLISTED accounts cannot sign in — proxy.ts rejects their session on the next request.');
  console.log('\nDemo data. No real users, no real funds, no payment is ever processed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
