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
