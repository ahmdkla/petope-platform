import { db } from './db';
import type { PaymentAsset, SpotType } from '@prisma/client';

/**
 * The last-sales feed: one entry per sale, sourced from deals rather than
 * listings.
 *
 * A sale is a DEAL that got funded, not a listing that ran out. That
 * distinction is the whole point:
 *
 *   - a five-spot listing that sells one spot has made a sale, and appears here
 *     immediately, while the listing itself is still ACTIVE with four left
 *   - the same listing selling twice produces two entries, because there were
 *     two transactions
 *
 * Filtering listings by SOLD_OUT — which is what this replaced — could express
 * neither: it showed inventory that had run out, once, never per transaction.
 *
 * `fundedAt` is the moment of sale. It is set when the middleman has confirmed
 * both payment proofs, which is also when spots leave the listing's supply, so
 * it is the earliest point at which anything was truly bought.
 */
export type Sale = {
  id: string;
  projectName: string;
  chain: string;
  /** Total for the transaction. Per-unit is derived, see `unitPrice`. */
  dealAmount: bigint;
  quantity: number;
  specific: SpotType;
  asset: PaymentAsset;
  collateralAmount: bigint | null;
  soldAt: Date;
  middleman: {
    id: string;
    displayName: string | null;
    isVerifiedMm: boolean;
    workingHoursUtc: string | null;
  } | null;
};

/**
 * Price for each, derived rather than stored.
 *
 * `dealAmount` is the total either way: for FOR_EACH it is unit × quantity, for
 * FOR_ALL it is the agreed lot price. Dividing by quantity gives the per-unit
 * figure in both cases, which is what the Discord feed shows and what a reader
 * compares between rows.
 */
export function unitPrice(sale: Pick<Sale, 'dealAmount' | 'quantity'>): bigint {
  if (sale.quantity <= 0) return sale.dealAmount;
  return sale.dealAmount / BigInt(sale.quantity);
}

/** Market figures for the stats rail, all derived from the fetched sales. */
export type SalesStats = {
  /** Summed per asset: SOL and stablecoins cannot be added together without a
   *  price feed, and this platform deliberately has none. */
  volume: { asset: PaymentAsset; total: bigint }[];
  totalSales: number;
  lastSevenDays: number;
  topMiddleman: { name: string; sales: number } | null;
  /** True when the fetch hit its cap, so the figures cover a window rather than
   *  all history. Surfaced in the UI rather than quietly rounded over. */
  capped: boolean;
};

export type SalesFeed = { sales: Sale[]; stats: SalesStats };

/**
 * The feed and its statistics from ONE query.
 *
 * The stats could be `count`/`aggregate` calls, but each extra query costs a
 * connection round trip — measured at ~120-200ms on a cold pool against Neon,
 * against ~32ms for a query on a warm one — so four aggregates would cost more
 * than reading the rows and adding them up here.
 *
 * The trade is that the figures describe the fetched window rather than all
 * history. `MAX_ROWS` is well above the current dataset, and `stats.capped`
 * tells the UI when that stops being true, so the page can say so instead of
 * quietly under-reporting.
 */
const MAX_ROWS = 500;

export async function getSalesFeed(display = 60): Promise<SalesFeed> {
  const all = await getRecentSales(MAX_ROWS);

  const volume = new Map<PaymentAsset, bigint>();
  const perMiddleman = new Map<string, number>();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let lastSevenDays = 0;

  for (const s of all) {
    volume.set(s.asset, (volume.get(s.asset) ?? 0n) + s.dealAmount);
    if (s.soldAt >= weekAgo) lastSevenDays += 1;
    const name = s.middleman?.displayName;
    if (name) perMiddleman.set(name, (perMiddleman.get(name) ?? 0) + 1);
  }

  const top = [...perMiddleman.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    sales: all.slice(0, display),
    stats: {
      volume: [...volume.entries()]
        .map(([asset, total]) => ({ asset, total }))
        .sort((a, b) => (b.total > a.total ? 1 : -1)),
      totalSales: all.length,
      lastSevenDays,
      topMiddleman: top ? { name: top[0], sales: top[1] } : null,
      capped: all.length >= MAX_ROWS,
    },
  };
}

export async function getRecentSales(limit = 60): Promise<Sale[]> {
  const deals = await db.deal.findMany({
    where: {
      // Funded means both payments were confirmed by a middleman and spots were
      // taken out of supply. Everything past that point counts as sold.
      fundedAt: { not: null },
      // A refunded or cancelled deal returned its spots; nothing was sold.
      // DISPUTED stays in: the money did move, and if it ends in a refund the
      // row drops out on its own.
      status: { notIn: ['REFUNDED', 'CANCELLED'] },
      // Test-suite deals are not trade history.
      isTest: false,
    },
    orderBy: { fundedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      projectName: true,
      chain: true,
      dealAmount: true,
      quantity: true,
      specific: true,
      asset: true,
      collateralAmount: true,
      fundedAt: true,
      middleman: {
        select: {
          id: true,
          displayName: true,
          isVerifiedMm: true,
          workingHoursUtc: true,
        },
      },
    },
  });

  return deals.map((d) => ({
    id: d.id,
    projectName: d.projectName,
    chain: d.chain,
    dealAmount: d.dealAmount,
    quantity: d.quantity,
    specific: d.specific,
    asset: d.asset,
    collateralAmount: d.collateralAmount,
    // Non-null by the `fundedAt` filter above; Prisma cannot narrow that.
    soldAt: d.fundedAt as Date,
    middleman: d.middleman,
  }));
}
