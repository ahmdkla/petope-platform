import type { DealMethod } from '@prisma/client';

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
