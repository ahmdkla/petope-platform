import type { PaymentAsset, PriceType } from '@prisma/client';

/**
 * Money is stored as BigInt in the asset's smallest unit and always travels
 * with its asset. Never a float, never a bare number.
 */

/**
 * The two things terms can be agreed in. USDC and USDT are interchangeable, so
 * a listing is priced in STABLE and the exact coin is settled at payment time.
 */
export type SettlementAsset = Extract<PaymentAsset, 'SOL' | 'STABLE'>;

export const SETTLEMENT_ASSETS: SettlementAsset[] = ['SOL', 'STABLE'];

/** What the user sees. STABLE is not a coin, so it is never shown as one. */
export const ASSET_LABEL: Record<PaymentAsset, string> = {
  SOL: 'SOL',
  STABLE: 'USDC/USDT',
  USDC: 'USDC',
  USDT: 'USDT',
};

/** The concrete coins a STABLE deal can actually be paid in. */
export const STABLE_COINS: PaymentAsset[] = ['USDC', 'USDT'];

export function isStable(asset: PaymentAsset): boolean {
  return asset === 'STABLE' || asset === 'USDC' || asset === 'USDT';
}

/**
 * Decimal places per asset. SOL has 9 (lamports); every stablecoin here has 6,
 * which is why STABLE can carry an amount before the coin is known.
 */
const DECIMALS: Record<PaymentAsset, number> = {
  SOL: 9,
  STABLE: 6,
  USDC: 6,
  USDT: 6,
};

/** Trailing zeros are noise in a table; keep at most this many decimals. */
const DISPLAY_DECIMALS: Record<PaymentAsset, number> = {
  SOL: 4,
  STABLE: 2,
  USDC: 2,
  USDT: 2,
};

export function formatAmount(amount: bigint, asset: PaymentAsset): string {
  const decimals = DECIMALS[asset];
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;

  const fracStr = frac
    .toString()
    .padStart(decimals, '0')
    .slice(0, DISPLAY_DECIMALS[asset])
    .replace(/0+$/, '');

  const wholeStr = whole.toLocaleString('en-US');
  return `${negative ? '-' : ''}${wholeStr}${fracStr ? `.${fracStr}` : ''}`;
}

/** Always render the asset beside the number — a bare figure is ambiguous. */
export function formatMoney(amount: bigint, asset: PaymentAsset): string {
  return `${formatAmount(amount, asset)} ${ASSET_LABEL[asset]}`;
}

/** Parse user input ("15.5") into smallest units. Returns null if unparseable. */
export function parseAmount(input: string, asset: PaymentAsset): bigint | null {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') return null;

  const decimals = DECIMALS[asset];
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > decimals) return null;

  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

/**
 * The single most misreadable field on a listing: "3 for $15 for all" is not
 * "3 for $15 for each". Always show the resolved total so it cannot be misread.
 */
export function resolveTotal(
  price: bigint,
  priceType: PriceType,
  quantity: number,
): bigint {
  return priceType === 'FOR_EACH' ? price * BigInt(quantity) : price;
}

export function describePriceType(priceType: PriceType): string {
  return priceType === 'FOR_EACH' ? 'each' : 'for all';
}
