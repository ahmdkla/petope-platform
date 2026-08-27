import type { DealStatus } from '@prisma/client';

/** Deal state is the most important thing on screen, so it gets colour. */
export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  OPEN: 'Open',
  CLAIMED: 'Claimed',
  TERMS_LOCKED: 'Terms locked',
  AWAITING_PAYMENT: 'Awaiting payment',
  FUNDED: 'Funded',
  DELIVERING: 'Delivering',
  AWAITING_MINT: 'Awaiting mint',
  AWAITING_CONFIRMATION: 'Awaiting confirmation',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

export const DEAL_STATUS_TONE: Record<
  DealStatus,
  'neutral' | 'accent' | 'ok' | 'danger' | 'warn' | 'info'
> = {
  OPEN: 'neutral',
  CLAIMED: 'info',
  TERMS_LOCKED: 'info',
  AWAITING_PAYMENT: 'warn',
  FUNDED: 'accent',
  DELIVERING: 'accent',
  AWAITING_MINT: 'warn',
  AWAITING_CONFIRMATION: 'warn',
  COMPLETED: 'ok',
  DISPUTED: 'danger',
  REFUNDED: 'danger',
  CANCELLED: 'neutral',
};

/** The 12 lifecycle states in order, for the progress timeline. */
export const LIFECYCLE_ORDER: DealStatus[] = [
  'OPEN',
  'CLAIMED',
  'TERMS_LOCKED',
  'AWAITING_PAYMENT',
  'FUNDED',
  'DELIVERING',
  'AWAITING_MINT',
  'AWAITING_CONFIRMATION',
  'COMPLETED',
];

export const TERMINAL_STATES: DealStatus[] = [
  'COMPLETED',
  'DISPUTED',
  'REFUNDED',
  'CANCELLED',
];
