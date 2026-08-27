import type { PaymentAsset } from '@prisma/client';

/**
 * Deliberately dependency-free: this module is imported by client components
 * to preview a fee, so it must not pull in the database client. Reading the
 * config from AdminSetting lives in lib/admin-settings.ts (server-only).
 */
export type MmFeeConfig = {
  /** Basis points, so the arithmetic stays integer. 500 = 5%. */
  percentBasisPoints: number;
  /**
   * Minimum fee per settlement asset, in that asset's smallest unit.
   *
   * Per-asset rather than a single USD figure because the platform has no price
   * feed and CLAUDE.md forbids adding one. The SOL floor is a hand-set
   * approximation of the USD minimum and drifts as SOL moves.
   */
  floor: Record<PaymentAsset, bigint>;
  /** How long after a deal closes the fee can still be refunded. */
  refundWindowHours: number;
};

/**
 * The MM fee — the ONLY place a fee is ever calculated.
 *
 *   base = dealAmount + collateral
 *   fee  = max(floor[asset], base x percent)
 *
 * Paid by the buyer on top of the deal amount, and non-refundable by default:
 * the single exception is the scammer window in app/admin/fee-refunds/.
 *
 * NEVER accept a fee from a client. It is computed server-side on every write,
 * from values the server already holds.
 */
export type FeeInput = {
  dealAmount: bigint;
  collateral: bigint | null;
  asset: PaymentAsset;
};

export type FeeBreakdown = {
  dealAmount: bigint;
  collateral: bigint;
  /** dealAmount + collateral — what the percentage applies to. */
  base: bigint;
  fee: bigint;
  /** True when the floor bit, i.e. the percentage came out below the minimum. */
  atFloor: boolean;
  /** What the buyer sends: deal amount + fee. Mint price is added per method. */
  buyerPays: bigint;
  asset: PaymentAsset;
};

export function computeMmFee(input: FeeInput, config: MmFeeConfig): FeeBreakdown {
  const collateral = input.collateral ?? 0n;
  const base = input.dealAmount + collateral;

  // Integer throughout: basis points out of 10_000, never a float.
  const percentage = (base * BigInt(config.percentBasisPoints)) / 10_000n;
  const floor = config.floor[input.asset];

  const atFloor = percentage < floor;
  const fee = atFloor ? floor : percentage;

  return {
    dealAmount: input.dealAmount,
    collateral,
    base,
    fee,
    atFloor,
    buyerPays: input.dealAmount + fee,
    asset: input.asset,
  };
}
