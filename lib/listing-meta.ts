import type { DealMethod, ListingType } from '@prisma/client';

/**
 * listing.type and deal.method are TWO SEPARATE TAXONOMIES (see CLAUDE.md).
 * This table supplies a UI default only. deal.method must still be explicitly
 * confirmed by both parties before terms_locked — never auto-derived.
 */
export const LISTING_TYPE_TO_METHOD: Record<ListingType, DealMethod | null> = {
  MINT: 'MINT_FOR_YOU',
  TOKEN_TRANSFER: 'OTC',
  WALLET_SUBMIT: 'WALLET_SUBMIT',
  WALLET_SURRENDER: 'WALLET_SURRENDER',
  ANY: null, // open to negotiation — MM and parties choose in the ticket
};

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  ANY: 'Any',
  MINT: 'Mint',
  TOKEN_TRANSFER: 'Token Transfer',
  WALLET_SUBMIT: 'Wallet Submit',
  WALLET_SURRENDER: 'Wallet Surrender',
};

/**
 * Shown inline when a type is chosen. Most disputes trace back to someone not
 * understanding the method they agreed to, so explain it at posting time.
 */
export const LISTING_TYPE_EXPLAINER: Record<ListingType, string> = {
  ANY: 'Open to negotiation. The escrow method is decided with the middleman inside the ticket.',
  MINT: 'The seller mints on your behalf and transfers the NFT. Buyer pays the mint price on top of the deal amount.',
  TOKEN_TRANSFER: 'A direct NFT sale with no mint involved. Shortest flow, no collateral.',
  WALLET_SUBMIT: 'The seller submits the buyer\u2019s wallet to the project. Collateral protects the buyer, who has to expose their wallet.',
  WALLET_SURRENDER: 'The seller hands over the wallet holding the whitelist. Funds release after the mint.',
};

/** Common values; the field stays free text because new chains appear constantly. */
export const COMMON_CHAINS = [
  'Solana',
  'Ethereum',
  'Base',
  'Robinhood',
  'Bitcoin',
  'Abstract',
  'Berachain',
  'Monad',
] as const;

export const SPOT_TYPE_LABEL = { GTD: 'GTD', FCFS: 'FCFS' } as const;

export const FCFS_WARNING =
  'FCFS spots are first come, first served. If you cannot mint because the project over-allocated, that is not the seller\u2019s fault and the deal is not refundable.';
