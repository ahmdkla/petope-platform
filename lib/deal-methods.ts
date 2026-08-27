import type { DealMethod, ProofKind } from '@prisma/client';

/**
 * The 7 escrow methods as CONFIGURATION, not branching code.
 *
 * Transcribed from docs/deal-methods.md, which is the source of truth for how
 * money and assets move. One shared engine reads this table, so adding or
 * tuning a method is a config change and the rules stay auditable in one place.
 *
 * Do not add `if (method === ...)` chains anywhere else — extend this table.
 * Changing any money flow here requires asking first (CLAUDE.md).
 */
export type BuyerPays = 'deal_amount' | 'mm_fee' | 'mint_price';

export type DealMethodRule = {
  id: DealMethod;
  label: string;
  /** One line the parties see before they confirm the method. */
  summary: string;
  buyerPays: BuyerPays[];
  requiresCollateral: boolean;
  collateralFormula: 'mint_price' | 'mint_price_plus_50' | 'agreed' | 'none';
  requiresMintEvent: boolean;
  /** What changes hands off-platform. The platform never carries it. */
  offPlatformHandover: 'discord_account' | 'private_key' | 'nft' | 'none';
  releaseTiming: 'after_mint' | 'after_submission_close' | 'on_buyer_confirm';
  buyerConfirmWindowHours: number | null;
  buyerSilenceAutoReleaseHours: number | null;
  sellerDeliveryDeadlineHours: number | null;
  collateralForfeitsTo: 'buyer' | 'seller' | null;
  /** Blocks selection in the UI when the flow is not documented yet. */
  implemented: boolean;
  /** Shown in the deal room so both parties see what they are agreeing to. */
  partyNotes: string[];
};

export const DEAL_METHOD_RULES: Record<DealMethod, DealMethodRule> = {
  DISCORD_SURRENDER: {
    id: 'DISCORD_SURRENDER',
    label: 'Discord Surrender',
    summary: 'The seller hands over a Discord account that holds the whitelist role.',
    buyerPays: ['deal_amount', 'mm_fee'],
    requiresCollateral: true,
    collateralFormula: 'mint_price',
    requiresMintEvent: true,
    offPlatformHandover: 'discord_account',
    // Elevated scam risk, so release is deliberately delayed until after mint.
    releaseTiming: 'after_mint',
    buyerConfirmWindowHours: null,
    buyerSilenceAutoReleaseHours: null,
    sellerDeliveryDeadlineHours: null,
    collateralForfeitsTo: 'buyer',
    implemented: true,
    partyNotes: [
      'Funds are held until after the mint. This method has elevated scam risk.',
      'Buyer: change the account email and password, then enable 2FA immediately.',
      'Buyer: verify the whitelist role exists on the account during the deal. The middleman is not responsible for the account after the deal closes.',
      'Account credentials are exchanged off-platform. Never paste them here.',
    ],
  },

  WALLET_SURRENDER: {
    id: 'WALLET_SURRENDER',
    label: 'Wallet Surrender',
    summary: 'The seller hands over the wallet that holds the whitelist.',
    buyerPays: ['deal_amount', 'mm_fee'],
    requiresCollateral: true,
    collateralFormula: 'mint_price',
    requiresMintEvent: true,
    offPlatformHandover: 'private_key',
    releaseTiming: 'after_mint',
    buyerConfirmWindowHours: null,
    buyerSilenceAutoReleaseHours: 24,
    sellerDeliveryDeadlineHours: null,
    collateralForfeitsTo: 'buyer',
    implemented: true,
    partyNotes: [
      'After wallet submission closes, the buyer must check the wallet for whitelist status.',
      'If the buyer cannot mint because of FCFS over-allocation, that is not the seller\u2019s fault and there is no refund.',
      'Both parties must be active on mint day and hold their own proof of whitelist.',
      'If the buyer does not respond in the room, funds release after 24 hours.',
      'The private key is sent off-platform. Never paste it here.',
    ],
  },

  WALLET_SUBMIT: {
    id: 'WALLET_SUBMIT',
    label: 'Wallet Submit',
    summary: 'The seller submits the buyer\u2019s wallet to the project.',
    buyerPays: ['deal_amount', 'mm_fee'],
    requiresCollateral: true,
    collateralFormula: 'agreed',
    requiresMintEvent: true,
    offPlatformHandover: 'private_key',
    releaseTiming: 'after_submission_close',
    buyerConfirmWindowHours: 2,
    buyerSilenceAutoReleaseHours: null,
    sellerDeliveryDeadlineHours: null,
    collateralForfeitsTo: 'buyer',
    implemented: true,
    partyNotes: [
      'Collateral exists here to stop the seller cancelling after the buyer has already exposed their wallet.',
      'The seller must provide proof of submission both before and after submission closes.',
      'If funds release after mint, the buyer has 2 hours maximum to confirm.',
      'The private key is sent off-platform. Never paste it here.',
    ],
  },

  MINT_FOR_YOU: {
    id: 'MINT_FOR_YOU',
    label: 'Mint For You',
    summary: 'The seller mints on the buyer\u2019s behalf and transfers the NFT.',
    // The only method where the buyer also funds the mint price.
    buyerPays: ['deal_amount', 'mm_fee', 'mint_price'],
    requiresCollateral: true,
    collateralFormula: 'mint_price',
    requiresMintEvent: true,
    offPlatformHandover: 'nft',
    releaseTiming: 'on_buyer_confirm',
    buyerConfirmWindowHours: null,
    buyerSilenceAutoReleaseHours: 24,
    sellerDeliveryDeadlineHours: 6,
    collateralForfeitsTo: 'buyer',
    implemented: true,
    partyNotes: [
      'The seller must send the NFT within 6 hours after mint.',
      'If the seller misses that window the deal fails and the buyer receives all funds.',
      'If the seller backs out or never sends, the collateral goes to the buyer as compensation.',
      'Both parties must be active on mint day.',
      'If the buyer does not respond in the room, funds release after 24 hours.',
    ],
  },

  PRESALE: {
    id: 'PRESALE',
    label: 'Presale',
    summary: 'A presale or allocation deal, settled as wallet surrender or NFT transfer.',
    buyerPays: ['deal_amount', 'mm_fee', 'mint_price'],
    requiresCollateral: true,
    collateralFormula: 'mint_price_plus_50',
    requiresMintEvent: true,
    offPlatformHandover: 'private_key',
    releaseTiming: 'on_buyer_confirm',
    buyerConfirmWindowHours: null,
    buyerSilenceAutoReleaseHours: null,
    sellerDeliveryDeadlineHours: null,
    collateralForfeitsTo: 'buyer',
    implemented: true,
    partyNotes: [
      'Collateral is the mint price plus 50 percent, or as otherwise agreed.',
      'Buyer and seller must agree a sub-type: wallet surrender or NFT transfer.',
      'For the NFT-transfer sub-type, funds release only after the buyer has received the NFTs and verified they are authentic.',
    ],
  },

  CODE: {
    id: 'CODE',
    label: 'Code',
    summary: 'The seller provides a mint or access code. Flow not yet documented.',
    buyerPays: ['deal_amount', 'mm_fee'],
    requiresCollateral: true,
    collateralFormula: 'agreed',
    requiresMintEvent: true,
    offPlatformHandover: 'none',
    releaseTiming: 'on_buyer_confirm',
    buyerConfirmWindowHours: null,
    buyerSilenceAutoReleaseHours: null,
    sellerDeliveryDeadlineHours: null,
    collateralForfeitsTo: 'buyer',
    // docs/deal-methods.md section 6: the source FAQ screenshot was cut off.
    // Do not implement until the flow is documented — the values above are
    // placeholders and must not be relied on.
    implemented: false,
    partyNotes: ['This method is not available yet: its flow is still undocumented.'],
  },

  OTC: {
    id: 'OTC',
    label: 'OTC',
    summary: 'A direct NFT sale with no mint involved.',
    buyerPays: ['deal_amount', 'mm_fee'],
    requiresCollateral: false,
    collateralFormula: 'none',
    requiresMintEvent: false,
    offPlatformHandover: 'nft',
    releaseTiming: 'on_buyer_confirm',
    buyerConfirmWindowHours: null,
    buyerSilenceAutoReleaseHours: null,
    sellerDeliveryDeadlineHours: null,
    collateralForfeitsTo: null,
    implemented: true,
    partyNotes: [
      'No collateral and no mint dependency, so this is the shortest flow.',
      'The middleman and buyer both verify the NFT is authentic before funds release.',
    ],
  },
};

export const SELECTABLE_METHODS = Object.values(DEAL_METHOD_RULES).filter(
  (m) => m.implemented,
);

export const BUYER_PAYS_LABEL: Record<BuyerPays, string> = {
  deal_amount: 'Deal amount',
  mm_fee: 'MM fee',
  mint_price: 'Mint price',
};

export const HANDOVER_LABEL: Record<DealMethodRule['offPlatformHandover'], string> = {
  discord_account: 'Discord account credentials',
  private_key: 'Wallet private key',
  nft: 'The NFT itself',
  none: 'Nothing',
};

/**
 * Whether cancelling by mutual agreement is still possible. Once private data
 * has been handed over, only dispute resolution applies (CLAUDE.md).
 */
export function canStillCancel(privateDataHandedOverAt: Date | null): boolean {
  return privateDataHandedOverAt === null;
}

/**
 * Which proofs must be CONFIRMED before a deal counts as funded.
 *
 * Derived from the method config, not hardcoded: the buyer always pays, and
 * collateral is required only where the method says so. Adding a method with
 * different funding needs is a change to the table above, not to this function.
 */
export function requiredProofKinds(method: DealMethod): ProofKind[] {
  const rule = DEAL_METHOD_RULES[method];
  const kinds: ProofKind[] = ['BUYER_PAYMENT'];
  if (rule.requiresCollateral) kinds.push('SELLER_COLLATERAL');
  return kinds;
}

/** Who is expected to submit each kind of proof. */
export const PROOF_SUBMITTER: Record<ProofKind, 'BUYER' | 'SELLER' | 'MIDDLEMAN'> = {
  BUYER_PAYMENT: 'BUYER',
  SELLER_COLLATERAL: 'SELLER',
  SELLER_NFT_TRANSFER: 'SELLER',
  MM_RELEASE: 'MIDDLEMAN',
  MM_REFUND: 'MIDDLEMAN',
  MM_COLLATERAL_RETURN: 'MIDDLEMAN',
};

export const PROOF_KIND_LABEL: Record<ProofKind, string> = {
  BUYER_PAYMENT: 'Buyer payment',
  SELLER_COLLATERAL: 'Seller collateral',
  MM_RELEASE: 'Release to seller',
  MM_REFUND: 'Refund to buyer',
  MM_COLLATERAL_RETURN: 'Collateral returned',
  SELLER_NFT_TRANSFER: 'NFT transfer',
};

/** What the buyer owes in total, per the method's buyerPays list. */
export function buyerTotal(
  method: DealMethod,
  amounts: { dealAmount: bigint; mmFee: bigint; mintPrice: bigint | null },
): bigint {
  const rule = DEAL_METHOD_RULES[method];
  let total = 0n;
  if (rule.buyerPays.includes('deal_amount')) total += amounts.dealAmount;
  if (rule.buyerPays.includes('mm_fee')) total += amounts.mmFee;
  if (rule.buyerPays.includes('mint_price')) total += amounts.mintPrice ?? 0n;
  return total;
}

/**
 * Whether this method's off-platform handover is PRIVATE DATA.
 *
 * Only a private key or Discord credentials close the cancellation window: once
 * a secret has left the seller's hands it cannot be un-shared. An NFT transfer
 * is a delivery — reversible in principle, and not a secret — so it does not.
 */
export function isPrivateDataHandover(method: DealMethod): boolean {
  const h = DEAL_METHOD_RULES[method].offPlatformHandover;
  return h === 'private_key' || h === 'discord_account';
}

/**
 * Proofs the middleman must record before a deal can complete.
 *
 * MM_RELEASE is the middleman's own record of paying the seller out. Unlike
 * BUYER_PAYMENT and SELLER_COLLATERAL it is NOT third-party verified — the
 * no-self-verification rule means the middleman cannot confirm their own
 * submission, and nobody else is positioned to. It exists as evidence in the
 * audit trail, which is exactly what the Discord workflow produces today.
 */
export function requiredReleaseProofKinds(
  method: DealMethod,
  hasCollateral: boolean,
): ProofKind[] {
  const kinds: ProofKind[] = ['MM_RELEASE'];
  if (DEAL_METHOD_RULES[method].requiresCollateral && hasCollateral) {
    kinds.push('MM_COLLATERAL_RETURN');
  }
  return kinds;
}

/** Proofs required on the refund path. Collateral destination is config-driven. */
export function requiredRefundProofKinds(
  method: DealMethod,
  hasCollateral: boolean,
): ProofKind[] {
  const kinds: ProofKind[] = ['MM_REFUND'];
  // When collateral forfeits to the buyer it is part of the refund, not a
  // separate return to the seller.
  if (
    hasCollateral &&
    DEAL_METHOD_RULES[method].collateralForfeitsTo === 'seller'
  ) {
    kinds.push('MM_COLLATERAL_RETURN');
  }
  return kinds;
}

export type ResolvedTimers = {
  sellerDeliveryDeadline: Date | null;
  buyerConfirmDeadline: Date | null;
  autoReleaseAt: Date | null;
};

/**
 * Resolve the method's timer windows into ABSOLUTE deadlines, once, at the
 * moment the timers start.
 *
 * They are stored rather than recomputed so that an admin retuning a window
 * cannot retroactively move a deadline on a deal already running, and so a
 * scheduled job can index-scan for due work. See docs/DECISIONS.md.
 */
export function resolveTimers(
  method: DealMethod,
  opts: { now: Date; mintAt: Date | null },
): ResolvedTimers {
  const rule = DEAL_METHOD_RULES[method];
  const hours = (n: number, from: Date) => new Date(from.getTime() + n * 3_600_000);

  return {
    // Measured from the mint event, not from now: the seller's window to hand
    // over the NFT starts when the mint happens.
    sellerDeliveryDeadline:
      rule.sellerDeliveryDeadlineHours !== null && opts.mintAt
        ? hours(rule.sellerDeliveryDeadlineHours, opts.mintAt)
        : null,
    buyerConfirmDeadline:
      rule.buyerConfirmWindowHours !== null
        ? hours(rule.buyerConfirmWindowHours, opts.now)
        : null,
    autoReleaseAt:
      rule.buyerSilenceAutoReleaseHours !== null
        ? hours(rule.buyerSilenceAutoReleaseHours, opts.now)
        : null,
  };
}
