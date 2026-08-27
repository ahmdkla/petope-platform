import type {
  Deal,
  DealStatus,
  ProofKind,
  TransactionAction,
} from '@prisma/client';
import {
  DEAL_METHOD_RULES,
  PROOF_KIND_LABEL,
  canStillCancel,
  requiredProofKinds,
} from './deal-methods';

/**
 * The lifecycle state machine, as configuration.
 *
 * Every state change goes through exactly one of these entries and through
 * applyTransition() in lib/deal-engine.ts. No status is ever written directly,
 * and no client request sets state — the server derives it.
 *
 * SCOPE: build-order step 3 stops at AWAITING_PAYMENT. Payment proofs, funding
 * and everything past it are step 4; those transitions are deliberately absent
 * rather than stubbed, so an unfinished path cannot be triggered by accident.
 */
export type ActorRole = 'BUYER' | 'SELLER' | 'MIDDLEMAN' | 'ADMIN';

export type TransitionId =
  | 'claim'
  | 'lock_terms'
  | 'open_payment_window'
  | 'mark_funded'
  | 'cancel';

export type TransitionContext = {
  deal: Deal;
  role: ActorRole;
  /**
   * Proof kinds already CONFIRMED by a middleman on this deal. Submitted and
   * rejected proofs are deliberately not represented: a SUBMITTED proof
   * advances nothing, so the funding guard must not be able to see one.
   */
  confirmedProofKinds?: ProofKind[];
};

export type TransitionRule = {
  id: TransitionId;
  label: string;
  /** What the actor is told will happen. */
  description: string;
  from: DealStatus[];
  to: DealStatus;
  /** Who may perform it. Admin is always additionally allowed. */
  actors: ActorRole[];
  action: TransactionAction;
  /** Rendered as a danger action and confirmed before running. */
  destructive?: boolean;
  /**
   * Returns an error string when the transition must not run, or null when it
   * may. Guards read the method config rather than branching on the method.
   */
  guard?: (ctx: TransitionContext) => string | null;
  /** Message the system bot posts into the room afterwards. */
  systemMessage: (ctx: TransitionContext) => string;
};

export const TRANSITIONS: Record<TransitionId, TransitionRule> = {
  claim: {
    id: 'claim',
    label: 'Claim this deal',
    description:
      'You become the assigned middleman and join the room. The buyer and seller can then agree terms with you.',
    from: ['OPEN'],
    to: 'CLAIMED',
    actors: ['MIDDLEMAN'],
    action: 'DEAL_CLAIMED',
    guard: ({ deal }) =>
      deal.middlemanId ? 'This deal already has an assigned middleman.' : null,
    systemMessage: () => 'A middleman claimed this deal and joined the room.',
  },

  lock_terms: {
    id: 'lock_terms',
    label: 'Lock terms',
    description:
      'Freezes the terms. Both parties must have confirmed the escrow method first. Changing anything afterwards needs both parties to re-confirm and is written to the audit log.',
    from: ['CLAIMED'],
    to: 'TERMS_LOCKED',
    actors: ['MIDDLEMAN'],
    action: 'TERMS_LOCKED',
    guard: ({ deal }) => {
      // The method is never auto-derived from listing.type — both parties
      // confirm it explicitly, and this is where that is enforced.
      if (!deal.method) return 'No escrow method has been agreed yet.';
      if (!deal.methodConfirmedByBuyerAt) return 'The buyer has not confirmed the method.';
      if (!deal.methodConfirmedBySellerAt) return 'The seller has not confirmed the method.';

      const rule = DEAL_METHOD_RULES[deal.method];
      if (!rule.implemented) {
        return `${rule.label} is not available yet: its flow is still undocumented.`;
      }
      if (deal.mmFee <= 0n) return 'Set the MM fee before locking terms.';
      if (rule.requiresCollateral && (deal.collateralAmount ?? 0n) <= 0n) {
        return `${rule.label} requires seller collateral. Set an amount before locking terms.`;
      }
      if (rule.requiresMintEvent && !deal.mintAt) {
        return `${rule.label} depends on a mint event. Set the mint date before locking terms.`;
      }
      if (rule.buyerPays.includes('mint_price') && (deal.mintPrice ?? 0n) <= 0n) {
        return `On ${rule.label} the buyer also pays the mint price. Set it before locking terms.`;
      }
      return null;
    },
    systemMessage: ({ deal }) =>
      `Terms locked. Escrow method: ${deal.method ? DEAL_METHOD_RULES[deal.method].label : 'unset'}.`,
  },

  open_payment_window: {
    id: 'open_payment_window',
    label: 'Request payment',
    description:
      'Moves the deal to awaiting payment. The buyer sends the deal amount and MM fee, the seller sends collateral — both off-platform, to your wallet.',
    from: ['TERMS_LOCKED'],
    to: 'AWAITING_PAYMENT',
    actors: ['MIDDLEMAN'],
    action: 'PAYMENT_REQUESTED',
    guard: ({ deal }) =>
      deal.termsLockedAt ? null : 'Terms must be locked before requesting payment.',
    systemMessage: () =>
      'Payment requested. Send funds to the middleman off-platform, then post the Solscan link in this room.',
  },

  mark_funded: {
    id: 'mark_funded',
    label: 'Mark as funded',
    description:
      'Records that every required payment has been personally verified. Only available once each required proof is confirmed.',
    from: ['AWAITING_PAYMENT'],
    to: 'FUNDED',
    actors: ['MIDDLEMAN'],
    action: 'DEAL_FUNDED',
    guard: ({ deal, confirmedProofKinds }) => {
      if (!deal.method) return 'No escrow method is set on this deal.';
      const confirmed = confirmedProofKinds ?? [];
      const missing = requiredProofKinds(deal.method).filter(
        (k) => !confirmed.includes(k),
      );
      if (missing.length > 0) {
        return `Still waiting on a confirmed proof for: ${missing
          .map((k) => PROOF_KIND_LABEL[k].toLowerCase())
          .join(' and ')}.`;
      }
      return null;
    },
    systemMessage: () =>
      'All required payments have been verified by the middleman. The deal is funded.',
  },

  cancel: {
    id: 'cancel',
    label: 'Cancel deal',
    description:
      'Closes the deal by mutual agreement. Only possible before any private data has been handed over.',
    from: ['OPEN', 'CLAIMED', 'TERMS_LOCKED', 'AWAITING_PAYMENT'],
    to: 'CANCELLED',
    actors: ['BUYER', 'SELLER', 'MIDDLEMAN'],
    action: 'DEAL_CANCELLED',
    destructive: true,
    guard: ({ deal }) =>
      canStillCancel(deal.privateDataHandedOverAt)
        ? null
        : 'Private data has already been handed over. This deal can only be closed through dispute resolution.',
    systemMessage: () => 'The deal was cancelled.',
  },
};

/** Terminal states carry no outgoing transitions. */
export const TERMINAL: DealStatus[] = ['COMPLETED', 'CANCELLED', 'REFUNDED'];

export type AvailableTransition = {
  rule: TransitionRule;
  /** Null when it can run; otherwise why it cannot, for a disabled control. */
  blockedReason: string | null;
};

/**
 * Every transition this actor could see on this deal, with the reason each is
 * blocked. The UI renders blocked ones disabled with the reason rather than
 * hiding them — a hidden control is indistinguishable from a broken one.
 */
export function availableTransitions(ctx: TransitionContext): AvailableTransition[] {
  return Object.values(TRANSITIONS)
    .filter((rule) => rule.from.includes(ctx.deal.status))
    .filter((rule) => rule.actors.includes(ctx.role) || ctx.role === 'ADMIN')
    .map((rule) => ({ rule, blockedReason: rule.guard?.(ctx) ?? null }));
}

/** Whole-machine check used by the engine before any write. */
export function checkTransition(
  id: TransitionId,
  ctx: TransitionContext,
): { ok: true; rule: TransitionRule } | { ok: false; error: string } {
  const rule = TRANSITIONS[id];
  if (!rule) return { ok: false, error: 'Unknown transition.' };

  if (!rule.from.includes(ctx.deal.status)) {
    return {
      ok: false,
      error: `This deal is ${ctx.deal.status.toLowerCase().replace(/_/g, ' ')}, so that step is not available.`,
    };
  }
  if (!rule.actors.includes(ctx.role) && ctx.role !== 'ADMIN') {
    return { ok: false, error: 'Your role cannot perform that step on this deal.' };
  }
  const blocked = rule.guard?.(ctx);
  if (blocked) return { ok: false, error: blocked };

  return { ok: true, rule };
}

/**
 * Timestamp columns each state sets on arrival. Kept beside the machine so a
 * new state cannot be added without deciding what it stamps.
 */
export const STATUS_TIMESTAMP: Partial<Record<DealStatus, keyof Deal>> = {
  CLAIMED: 'claimedAt',
  TERMS_LOCKED: 'termsLockedAt',
  FUNDED: 'fundedAt',
  COMPLETED: 'completedAt',
  CANCELLED: 'cancelledAt',
};
