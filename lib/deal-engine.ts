import type { Deal, Prisma, ProofKind } from '@prisma/client';
import { db } from './db';
import { assertDealParticipant } from './deal-access';
import type { CurrentUser } from './session';
import {
  checkTransition,
  resolveTarget,
  STATUS_TIMESTAMP,
  type ActorRole,
  type TransitionId,
} from './deal-transitions';

export type EngineResult = { ok: true; deal: Deal } | { ok: false; error: string };

/**
 * The ONLY way a deal's status changes.
 *
 * Everything happens in one transaction: guard check, status write, timestamp,
 * an immutable TransactionLog row, and a system message in the room. If any
 * part fails the whole thing rolls back, so a state change can never exist
 * without its ledger entry.
 *
 * Never write `deal.status` anywhere else.
 */
export async function applyTransition(
  dealId: string,
  transitionId: TransitionId,
  user: CurrentUser,
  extra?: { metadata?: Prisma.InputJsonValue },
): Promise<EngineResult> {
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: 'Deal not found.' };

  // Permissions are per-deal, not global. One shared helper, never hand-rolled.
  // audit:false — a transition is an action, not a room read, and the page view
  // that led here already wrote its AUDIT_ACCESS row.
  const access = await assertDealParticipant(deal, user, { audit: false });
  if (!access.allowed) return { ok: false, error: 'You are not a party to this deal.' };

  const role: ActorRole = access.role;

  const now = new Date();
  // Only CONFIRMED proofs count toward funding — a SUBMITTED proof must be
  // invisible to that guard. `recorded` additionally covers the middleman's own
  // outgoing-payment records, which cannot be third-party confirmed.
  const { confirmedProofKinds, recordedProofKinds } = await loadProofKinds(dealId);

  // Read outside the transaction only to render a useful pre-check; the
  // authoritative read happens inside, where the race actually matters.
  const listing = deal.listingId
    ? await db.listing.findUnique({
        where: { id: deal.listingId },
        select: { quantityRemaining: true },
      })
    : null;

  const baseCtx = {
    role,
    confirmedProofKinds,
    recordedProofKinds,
    now,
    listingQuantityRemaining: listing?.quantityRemaining ?? null,
  };

  const check = checkTransition(transitionId, { deal, ...baseCtx });
  if (!check.ok) return { ok: false, error: check.error };
  const { rule } = check;

  const target = resolveTarget(rule, { deal, ...baseCtx });
  const timestampField = STATUS_TIMESTAMP[target];

  let updated: Deal;
  try {
    updated = await db.$transaction(async (tx) => {
    // Re-read inside the transaction so two concurrent claims cannot both win.
    const fresh = await tx.deal.findUniqueOrThrow({ where: { id: dealId } });
    /**
     * Re-read supply inside the transaction and re-run the guard against it.
     * Two middlemen funding competing deals on the same listing at the same
     * moment is exactly the case this catches: whichever commits second sees
     * the decremented figure and is refused.
     */
    const freshListing = fresh.listingId
      ? await tx.listing.findUnique({
          where: { id: fresh.listingId },
          select: { id: true, quantityRemaining: true, status: true },
        })
      : null;

    const txCtx = {
      ...baseCtx,
      listingQuantityRemaining: freshListing?.quantityRemaining ?? null,
    };

    const recheck = checkTransition(transitionId, { deal: fresh, ...txCtx });
    if (!recheck.ok) throw new TransitionConflict(recheck.error);

    // Extra columns the target state stamps on arrival (timer deadlines,
    // handover marks). Config-driven, never hardcoded here.
    const entered = rule.onEnter?.({ deal: fresh, ...txCtx }) ?? {};

    // --- supply, per the rule's declared intent -----------------------------
    let spotsStamp: Record<string, Date | null> = {};

    if (rule.supply === 'reserve' && freshListing) {
      const remaining = freshListing.quantityRemaining - fresh.quantity;
      await tx.listing.update({
        where: { id: freshListing.id },
        data: {
          quantityRemaining: remaining,
          // Sold out listings stay visible; they just take no new deals.
          ...(remaining <= 0 ? { status: 'SOLD_OUT' as const } : {}),
        },
      });
      spotsStamp = { spotsReservedAt: now };
    }

    if (rule.supply === 'release' && freshListing && fresh.spotsReservedAt) {
      // Only a deal that actually reserved gives spots back — cancelling an
      // unfunded deal must not invent supply.
      const remaining = freshListing.quantityRemaining + fresh.quantity;
      await tx.listing.update({
        where: { id: freshListing.id },
        data: {
          quantityRemaining: remaining,
          ...(freshListing.status === 'SOLD_OUT' && remaining > 0
            ? { status: 'ACTIVE' as const }
            : {}),
        },
      });
      spotsStamp = { spotsReservedAt: null };
    }

    const next = await tx.deal.update({
      where: { id: dealId },
      data: {
        status: target,
        ...(timestampField ? { [timestampField]: now } : {}),
        ...(transitionId === 'claim' ? { middlemanId: user.id } : {}),
        ...entered,
        ...spotsStamp,
      },
    });

    await tx.transactionLog.create({
      data: {
        dealId,
        actorId: user.id,
        action: rule.action,
        fromStatus: fresh.status,
        toStatus: target,
        metadata: {
          transition: rule.id,
          role,
          ...(extra?.metadata as Record<string, unknown> | undefined),
        },
      },
    });

    // One immutable row per fund movement, beside the transition row itself.
    for (const entry of rule.ledgerEntries?.({ deal: next, ...txCtx }) ?? []) {
      await tx.transactionLog.create({
        data: {
          dealId,
          actorId: user.id,
          action: entry.action,
          amount: entry.amount ?? null,
          asset: entry.amount ? next.asset : null,
          fromStatus: fresh.status,
          toStatus: target,
          metadata: { transition: rule.id, note: entry.note },
        },
      });
    }

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null, // system bot
        kind: 'SYSTEM',
        body: rule.systemMessage({ deal: next, ...txCtx }),
      },
    });

      return next;
    });
  } catch (e) {
    // A lost race is an ordinary outcome here, not a crash: another middleman
    // claimed the deal between the first check and the write.
    if (e instanceof TransitionConflict) return { ok: false, error: e.message };
    throw e;
  }

  return { ok: true, deal: updated };
}

class TransitionConflict extends Error {}

/**
 * Proof kinds on this deal, split by how much weight a guard may give them.
 * `confirmed` is CONFIRMED only. `recorded` is anything not rejected.
 */
export async function loadProofKinds(
  dealId: string,
): Promise<{ confirmedProofKinds: ProofKind[]; recordedProofKinds: ProofKind[] }> {
  const rows = await db.paymentProof.findMany({
    where: { dealId, status: { in: ['SUBMITTED', 'CONFIRMED'] } },
    select: { kind: true, status: true },
  });
  return {
    confirmedProofKinds: [
      ...new Set(rows.filter((r) => r.status === 'CONFIRMED').map((r) => r.kind)),
    ],
    recordedProofKinds: [...new Set(rows.map((r) => r.kind))],
  };
}

/**
 * Records a party's confirmation of the escrow method.
 *
 * This is not a status transition — it is the gate that lock_terms checks.
 * Both parties confirm independently and either can withdraw before terms lock.
 */
export async function confirmMethod(
  dealId: string,
  user: CurrentUser,
  confirmed: boolean,
): Promise<EngineResult> {
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: 'Deal not found.' };

  const access = await assertDealParticipant(deal, user, { audit: false });
  if (!access.allowed) return { ok: false, error: 'You are not a party to this deal.' };
  if (access.role !== 'BUYER' && access.role !== 'SELLER') {
    return { ok: false, error: 'Only the buyer and the seller confirm the method.' };
  }
  if (deal.status !== 'CLAIMED') {
    return { ok: false, error: 'The method can only be confirmed before terms are locked.' };
  }
  if (!deal.method) {
    return { ok: false, error: 'The middleman has not proposed a method yet.' };
  }

  const field = access.role === 'BUYER' ? 'methodConfirmedByBuyerAt' : 'methodConfirmedBySellerAt';

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.deal.update({
      where: { id: dealId },
      data: { [field]: confirmed ? new Date() : null },
    });

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null,
        kind: 'SYSTEM',
        body: `${access.role === 'BUYER' ? 'The buyer' : 'The seller'} ${
          confirmed ? 'confirmed' : 'withdrew confirmation of'
        } the escrow method.`,
      },
    });

    return next;
  });

  return { ok: true, deal: updated };
}

/**
 * Records a party's acknowledgement that the off-platform handover happened.
 *
 * Like method confirmation, this is not a status transition — it is the gate
 * that complete_handover checks. The platform never sees what changed hands;
 * it records only that both parties said it did, and when.
 */
export async function declareHandover(
  dealId: string,
  user: CurrentUser,
  declared: boolean,
): Promise<EngineResult> {
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: 'Deal not found.' };

  const access = await assertDealParticipant(deal, user, { audit: false });
  if (!access.allowed) return { ok: false, error: 'You are not a party to this deal.' };
  if (access.role !== 'BUYER' && access.role !== 'SELLER') {
    return { ok: false, error: 'Only the buyer and the seller acknowledge the handover.' };
  }
  if (deal.status !== 'DELIVERING') {
    return { ok: false, error: 'The handover can only be acknowledged during delivery.' };
  }
  // Withdrawing after the window has closed would misrepresent the record.
  if (!declared && deal.privateDataHandedOverAt) {
    return {
      ok: false,
      error: 'Private data has already changed hands. This acknowledgement cannot be withdrawn.',
    };
  }

  const field =
    access.role === 'BUYER' ? 'handoverDeclaredByBuyerAt' : 'handoverDeclaredBySellerAt';

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.deal.update({
      where: { id: dealId },
      data: { [field]: declared ? new Date() : null },
    });

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null,
        kind: 'SYSTEM',
        body: `${access.role === 'BUYER' ? 'The buyer' : 'The seller'} ${
          declared ? 'acknowledged' : 'withdrew their acknowledgement of'
        } the off-platform handover.`,
      },
    });

    return next;
  });

  return { ok: true, deal: updated };
}

/**
 * The buyer confirming they received what they paid for. Unblocks release.
 * Never inferred from silence — silence is handled by the autoReleaseAt window,
 * which is a separate condition the release guard checks.
 */
export async function confirmReceipt(
  dealId: string,
  user: CurrentUser,
): Promise<EngineResult> {
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: 'Deal not found.' };

  const access = await assertDealParticipant(deal, user, { audit: false });
  if (!access.allowed) return { ok: false, error: 'You are not a party to this deal.' };
  if (access.role !== 'BUYER') {
    return { ok: false, error: 'Only the buyer confirms receipt.' };
  }
  if (deal.status !== 'AWAITING_CONFIRMATION') {
    return { ok: false, error: 'There is nothing to confirm receipt of yet.' };
  }
  if (deal.receiptConfirmedAt) {
    return { ok: false, error: 'You have already confirmed receipt.' };
  }

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.deal.update({
      where: { id: dealId },
      data: { receiptConfirmedAt: new Date() },
    });

    await tx.transactionLog.create({
      data: {
        dealId,
        actorId: user.id,
        action: 'RECEIPT_CONFIRMED',
        fromStatus: deal.status,
        toStatus: deal.status,
        metadata: { role: 'BUYER' },
      },
    });

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null,
        kind: 'SYSTEM',
        body: 'The buyer confirmed receipt. The middleman can now release funds.',
      },
    });

    return next;
  });

  return { ok: true, deal: updated };
}
