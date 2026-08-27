import type { PaymentAsset } from '@prisma/client';
import { db } from './db';
import { computeMmFee, type FeeBreakdown, type FeeInput, type MmFeeConfig } from './mm-fee';

export type { MmFeeConfig };

/**
 * Admin-tunable values, read from the AdminSetting table.
 *
 * Nothing in this file is a hardcoded business rule: the defaults below exist
 * so a fresh database works before an admin has touched anything, and every one
 * of them is overridable by the row of the same key.
 */

const MM_FEE_DEFAULT: MmFeeConfig = {
  percentBasisPoints: 500,
  // STABLE is the settlement value; USDC/USDT mirror it so a fee computed
  // against a concrete coin resolves to the same floor.
  floor: {
    STABLE: 5_000_000n,
    USDC: 5_000_000n,
    USDT: 5_000_000n,
    SOL: 30_000_000n,
  },
  refundWindowHours: 24,
};

export async function getMmFeeConfig(): Promise<MmFeeConfig> {
  const row = await db.adminSetting.findUnique({ where: { key: 'mmFee.config' } });
  if (!row) return MM_FEE_DEFAULT;

  const v = row.value as {
    percentBasisPoints?: number;
    floor?: Partial<Record<PaymentAsset, number | string>>;
    refundWindowHours?: number;
  };

  const floor = { ...MM_FEE_DEFAULT.floor };
  for (const asset of ['SOL', 'STABLE', 'USDC', 'USDT'] as PaymentAsset[]) {
    const raw = v.floor?.[asset];
    if (raw !== undefined) floor[asset] = BigInt(raw);
  }
  // Config only needs to state STABLE; the concrete coins follow it.
  if (v.floor?.STABLE !== undefined) {
    floor.USDC = floor.STABLE;
    floor.USDT = floor.STABLE;
  }

  return {
    percentBasisPoints:
      typeof v.percentBasisPoints === 'number'
        ? v.percentBasisPoints
        : MM_FEE_DEFAULT.percentBasisPoints,
    floor,
    refundWindowHours:
      typeof v.refundWindowHours === 'number'
        ? v.refundWindowHours
        : MM_FEE_DEFAULT.refundWindowHours,
  };
}

/** Minimum seller collateral. Never a hardcoded value — see CLAUDE.md. */
export async function getCollateralMinimum(): Promise<{
  amount: bigint;
  asset: string;
} | null> {
  const row = await db.adminSetting.findUnique({
    where: { key: 'collateral.minimum' },
  });
  if (!row) return null;
  const v = row.value as { amount?: number; asset?: string };
  if (typeof v.amount !== 'number' || !v.asset) return null;
  return { amount: BigInt(v.amount), asset: v.asset };
}

const MAX_CONCURRENT_DEALS_DEFAULT = 7;

/**
 * How many active deals one listing may carry at once. Deals do not reserve
 * spots until funding, so this caps competition rather than supply.
 */
export async function getMaxConcurrentDeals(): Promise<number> {
  const row = await db.adminSetting.findUnique({
    where: { key: 'listing.maxConcurrentDeals' },
  });
  const v = row?.value as { max?: number } | undefined;
  return typeof v?.max === 'number' && v.max > 0 ? v.max : MAX_CONCURRENT_DEALS_DEFAULT;
}

/** Convenience for server code that has not already loaded the config. */
export async function calculateMmFee(input: FeeInput): Promise<FeeBreakdown> {
  return computeMmFee(input, await getMmFeeConfig());
}
