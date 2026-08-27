import type { Deal, DealStatus } from '@prisma/client';

/**
 * The lifecycle, grouped for humans.
 *
 * The database keeps all 12 states — this is presentation only. Showing a
 * buyer "awaiting_mint" then "awaiting_confirmation" as separate numbered steps
 * exposes internal machinery; what they need to know is which of five things is
 * happening and who is holding it up.
 */
export type StageId = 'terms' | 'payment' | 'delivery' | 'confirmation' | 'complete';

export type Stage = {
  id: StageId;
  label: string;
  states: DealStatus[];
};

export const STAGES: Stage[] = [
  { id: 'terms', label: 'Agreeing terms', states: ['OPEN', 'CLAIMED', 'TERMS_LOCKED'] },
  { id: 'payment', label: 'Payment', states: ['AWAITING_PAYMENT', 'FUNDED'] },
  { id: 'delivery', label: 'Delivery', states: ['DELIVERING', 'AWAITING_MINT'] },
  { id: 'confirmation', label: 'Confirmation', states: ['AWAITING_CONFIRMATION'] },
  { id: 'complete', label: 'Complete', states: ['COMPLETED'] },
];

/** States that never appear as a step, because they leave the path. */
export const OFF_PATH: DealStatus[] = ['DISPUTED', 'REFUNDED', 'CANCELLED'];

export function stageOf(status: DealStatus): Stage | null {
  return STAGES.find((s) => s.states.includes(status)) ?? null;
}

export function stageIndexOf(status: DealStatus): number {
  return STAGES.findIndex((s) => s.states.includes(status));
}

export function isOffPath(status: DealStatus): boolean {
  return OFF_PATH.includes(status);
}

/**
 * One plain sentence: what is happening, and who is waiting on whom.
 * Deliberately names a party rather than describing a state.
 */
export function stageSentence(deal: Pick<Deal, 'status' | 'middlemanId' | 'mintAt' | 'method'>): string {
  const mintDate = deal.mintAt
    ? deal.mintAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : null;

  switch (deal.status) {
    case 'OPEN':
      return 'Waiting for a middleman to claim this deal and join the room.';
    case 'CLAIMED':
      return deal.method
        ? 'Waiting on the buyer and seller to confirm the escrow method.'
        : 'Waiting on the middleman to propose the escrow method and terms.';
    case 'TERMS_LOCKED':
      return 'Terms are agreed. Waiting on the middleman to open the payment window.';
    case 'AWAITING_PAYMENT':
      return 'Waiting on the buyer to send payment and the seller to send collateral, then on the middleman to verify both.';
    case 'FUNDED':
      return 'Both payments are verified. Waiting on the middleman to start the handover.';
    case 'DELIVERING':
      return 'The handover happens off-platform. Waiting on both parties to acknowledge it here.';
    case 'AWAITING_MINT':
      return mintDate
        ? `Waiting on the project's mint on ${mintDate}. This can take days or weeks — that is normal.`
        : "Waiting on the project's mint. This can take days or weeks — that is normal.";
    case 'AWAITING_CONFIRMATION':
      return 'Waiting on the buyer to confirm they received what they paid for.';
    case 'COMPLETED':
      return 'Funds released to the seller and collateral returned. This deal is finished.';
    case 'DISPUTED':
      return 'Escalated to the middleman team. A main middleman will review it and decide.';
    case 'REFUNDED':
      return 'The buyer was refunded. This deal is closed.';
    case 'CANCELLED':
      return 'Closed by agreement before anything changed hands.';
    default:
      return '';
  }
}

/** Heading for the off-path panel that replaces the timeline. */
export const OFF_PATH_TITLE: Record<string, string> = {
  DISPUTED: 'Under review',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};
