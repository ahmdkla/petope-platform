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
  isPrivateDataHandover,
  requiredProofKinds,
  requiredReleaseProofKinds,
  requiredRefundProofKinds,
  resolveTimers,
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
  | 'begin_delivery'
  | 'complete_handover'
  | 'reach_mint'
  | 'release_funds'
  | 'escalate'
  | 'refund'
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
  /**
   * Kinds with a proof that has NOT been rejected (submitted or confirmed).
   * The middleman's own MM_RELEASE / MM_REFUND records live here: they cannot
   * be third-party confirmed, because nobody may verify their own submission.
   */
  recordedProofKinds?: ProofKind[];
  /** Injected by the engine so guards never call `new Date()` themselves. */
  now?: Date;
};

export type LedgerEntry = {
  action: TransactionAction;
  amount?: bigint | null;
  note: string;
};

export type TransitionRule = {
  id: TransitionId;
  label: string;
  /** What the actor is told will happen. */
  description: string;
  from: DealStatus[];
  /** A function when the target depends on the method (mint vs no mint). */
  to: DealStatus | ((ctx: TransitionContext) => DealStatus);
  /**
   * Extra columns to write on arrival — timer deadlines, handover stamps.
   * Config, so a new state cannot be added without deciding what it sets.
   */
  onEnter?: (ctx: TransitionContext) => Record<string, Date | null>;
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
  /**
   * Additional ledger rows for the money that moves on this transition.
   * Every fund movement writes its own immutable row, so a completed deal shows
   * the fee and the collateral separately from the release itself.
   */
  ledgerEntries?: (ctx: TransitionContext) => LedgerEntry[];
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

  begin_delivery: {
    id: 'begin_delivery',
    label: 'Start delivery',
    description:
      'Opens the handover step. Both parties then acknowledge the off-platform handover once it has happened.',
    from: ['FUNDED'],
    to: 'DELIVERING',
    actors: ['MIDDLEMAN'],
    action: 'DELIVERY_MARKED',
    systemMessage: ({ deal }) => {
      const rule = deal.method ? DEAL_METHOD_RULES[deal.method] : null;
      return rule
        ? `Delivery started. ${rule.label}: the handover happens off-platform and both parties confirm it here.`
        : 'Delivery started.';
    },
  },

  complete_handover: {
    id: 'complete_handover',
    label: 'Confirm handover complete',
    description:
      'Records that the off-platform handover happened. Both parties must have acknowledged it first.',
    from: ['DELIVERING'],
    // Methods with no mint event skip straight to confirmation.
    to: ({ deal }) =>
      deal.method && DEAL_METHOD_RULES[deal.method].requiresMintEvent
        ? 'AWAITING_MINT'
        : 'AWAITING_CONFIRMATION',
    actors: ['MIDDLEMAN'],
    action: 'HANDOVER_DECLARED',
    guard: ({ deal }) => {
      if (!deal.handoverDeclaredByBuyerAt)
        return 'The buyer has not acknowledged the handover.';
      if (!deal.handoverDeclaredBySellerAt)
        return 'The seller has not acknowledged the handover.';
      return null;
    },
    onEnter: ({ deal, now }) => {
      const stamps: Record<string, Date | null> = {};
      // Closing the cancellation window is a one-way door, so it is stamped
      // only for methods where a secret actually changed hands.
      if (deal.method && isPrivateDataHandover(deal.method)) {
        stamps.privateDataHandedOverAt = now ?? new Date();
      }
      // No mint event means the confirmation timers start here.
      if (deal.method && !DEAL_METHOD_RULES[deal.method].requiresMintEvent) {
        Object.assign(
          stamps,
          resolveTimers(deal.method, { now: now ?? new Date(), mintAt: deal.mintAt }),
        );
      }
      return stamps;
    },
    systemMessage: ({ deal }) =>
      deal.method && isPrivateDataHandover(deal.method)
        ? 'Both parties acknowledged the handover. Private data has changed hands, so this deal can no longer be cancelled by agreement, only through dispute resolution.'
        : 'Both parties acknowledged the handover.',
  },

  reach_mint: {
    id: 'reach_mint',
    label: 'Mint has happened',
    description:
      'Records that the project minted. This starts the release timers, resolved from the method rules.',
    from: ['AWAITING_MINT'],
    to: 'AWAITING_CONFIRMATION',
    actors: ['MIDDLEMAN'],
    action: 'DELIVERY_MARKED',
    guard: ({ deal, now }) => {
      if (!deal.mintAt) return 'No mint date is set on this deal.';
      if (deal.mintAt > (now ?? new Date())) {
        return 'The mint date has not passed yet. Update it if the project moved.';
      }
      return null;
    },
    // Deadlines are resolved ONCE, here, and stored as absolute values.
    onEnter: ({ deal, now }) =>
      deal.method
        ? resolveTimers(deal.method, { now: now ?? new Date(), mintAt: deal.mintAt })
        : {},
    systemMessage: ({ deal }) => {
      const rule = deal.method ? DEAL_METHOD_RULES[deal.method] : null;
      if (!rule) return 'The mint has happened.';
      const parts: string[] = [];
      if (rule.sellerDeliveryDeadlineHours)
        parts.push(`seller delivers within ${rule.sellerDeliveryDeadlineHours}h`);
      if (rule.buyerConfirmWindowHours)
        parts.push(`buyer confirms within ${rule.buyerConfirmWindowHours}h`);
      if (rule.buyerSilenceAutoReleaseHours)
        parts.push(`buyer silence releases after ${rule.buyerSilenceAutoReleaseHours}h`);
      return `The mint has happened. Release timers started${parts.length ? `: ${parts.join(', ')}` : ''}.`;
    },
  },

  release_funds: {
    id: 'release_funds',
    label: 'Release funds',
    description:
      'Completes the deal. Record the outgoing payments first. This is never automatic and cannot be undone.',
    from: ['AWAITING_CONFIRMATION'],
    to: 'COMPLETED',
    actors: ['MIDDLEMAN'],
    action: 'FUNDS_RELEASED',
    destructive: true,
    guard: ({ deal, recordedProofKinds, now }) => {
      if (!deal.method) return 'No escrow method is set on this deal.';
      const at = now ?? new Date();

      // The buyer's confirmation is required UNLESS their silence window has
      // elapsed. That window does not move money on its own: it only stops
      // buyer silence from blocking a release the middleman still performs.
      const silenceElapsed = deal.autoReleaseAt !== null && deal.autoReleaseAt <= at;
      if (!deal.receiptConfirmedAt && !silenceElapsed) {
        return deal.autoReleaseAt
          ? 'Waiting on the buyer to confirm receipt, or on their response window to elapse.'
          : 'The buyer has not confirmed receipt.';
      }

      const recorded = recordedProofKinds ?? [];
      const missing = requiredReleaseProofKinds(
        deal.method,
        (deal.collateralAmount ?? 0n) > 0n,
      ).filter((k) => !recorded.includes(k));
      if (missing.length > 0) {
        return `Record the outgoing payment first: ${missing
          .map((k) => PROOF_KIND_LABEL[k].toLowerCase())
          .join(' and ')}.`;
      }
      return null;
    },
    ledgerEntries: ({ deal }) => {
      const entries: LedgerEntry[] = [];
      if (deal.mmFee > 0n) {
        entries.push({
          action: 'MM_FEE_TAKEN',
          amount: deal.mmFee,
          note: 'Middleman fee retained from the buyer payment.',
        });
      }
      if ((deal.collateralAmount ?? 0n) > 0n) {
        entries.push({
          action: 'COLLATERAL_RETURNED',
          amount: deal.collateralAmount,
          note: 'Seller collateral returned on successful completion.',
        });
      }
      return entries;
    },
    systemMessage: ({ deal }) =>
      `Funds released to the seller${
        (deal.collateralAmount ?? 0n) > 0n ? ' and collateral returned' : ''
      }. The middleman fee has been taken. This deal is complete.`,
  },

  escalate: {
    id: 'escalate',
    label: 'Escalate to dispute',
    description:
      'Sends this deal to the middleman team for review. Use when the parties cannot agree.',
    from: ['FUNDED', 'DELIVERING', 'AWAITING_MINT', 'AWAITING_CONFIRMATION'],
    to: 'DISPUTED',
    actors: ['BUYER', 'SELLER', 'MIDDLEMAN'],
    action: 'DEAL_ESCALATED',
    destructive: true,
    systemMessage: () =>
      'This deal was escalated to the middleman team. A main middleman will review it.',
  },

  refund: {
    id: 'refund',
    label: 'Refund the buyer',
    description:
      'Closes the dispute by returning funds to the buyer. Record the outgoing payments first. Cannot be undone.',
    from: ['DISPUTED'],
    to: 'REFUNDED',
    // A dispute ruling is the main middleman's call, not the assigned one's.
    actors: ['ADMIN'],
    action: 'REFUND_ISSUED',
    destructive: true,
    guard: ({ deal, recordedProofKinds }) => {
      if (!deal.method) return 'No escrow method is set on this deal.';
      const recorded = recordedProofKinds ?? [];
      const missing = requiredRefundProofKinds(
        deal.method,
        (deal.collateralAmount ?? 0n) > 0n,
      ).filter((k) => !recorded.includes(k));
      if (missing.length > 0) {
        return `Record the outgoing payment first: ${missing
          .map((k) => PROOF_KIND_LABEL[k].toLowerCase())
          .join(' and ')}.`;
      }
      return null;
    },
    ledgerEntries: ({ deal }) => {
      const entries: LedgerEntry[] = [];
      const collateral = deal.collateralAmount ?? 0n;
      if (collateral > 0n && deal.method) {
        // Destination comes from the method config, never from a branch here.
        const to = DEAL_METHOD_RULES[deal.method].collateralForfeitsTo;
        if (to === 'buyer') {
          entries.push({
            action: 'COLLATERAL_FORFEITED',
            amount: collateral,
            note: 'Collateral forfeited to the buyer as compensation.',
          });
        } else if (to === 'seller') {
          entries.push({
            action: 'COLLATERAL_RETURNED',
            amount: collateral,
            note: 'Collateral returned to the seller.',
          });
        }
      }
      // The fee is reversed on a refund: the deal did not complete.
      if (deal.mmFee > 0n) {
        entries.push({
          action: 'MM_FEE_REFUNDED',
          amount: deal.mmFee,
          note: 'Middleman fee returned to the buyer with the refund.',
        });
      }
      return entries;
    },
    systemMessage: ({ deal }) => {
      const forfeitsTo =
        deal.method && (deal.collateralAmount ?? 0n) > 0n
          ? DEAL_METHOD_RULES[deal.method].collateralForfeitsTo
          : null;
      if (forfeitsTo === 'buyer') {
        return 'The buyer was refunded. The collateral was forfeited to the buyer as compensation.';
      }
      if (forfeitsTo === 'seller') {
        return 'The buyer was refunded. The collateral was returned to the seller.';
      }
      return 'The buyer was refunded.';
    },
  },

  cancel: {
    id: 'cancel',
    label: 'Cancel deal',
    description:
      'Closes the deal by mutual agreement. Only possible before any private data has been handed over.',
    // Cancellable right up to the handover: money being held is reversible,
    // a disclosed secret is not. The guard is what actually closes the window.
    from: ['OPEN', 'CLAIMED', 'TERMS_LOCKED', 'AWAITING_PAYMENT', 'FUNDED', 'DELIVERING'],
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

/** Resolves a rule's target, which may depend on the deal's method. */
export function resolveTarget(rule: TransitionRule, ctx: TransitionContext): DealStatus {
  return typeof rule.to === 'function' ? rule.to(ctx) : rule.to;
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
