import type { Deal, Prisma } from '@prisma/client';
import { db } from './db';
import { assertDealParticipant } from './deal-access';
import type { CurrentUser } from './session';
import {
  checkTransition,
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

  const check = checkTransition(transitionId, { deal, role });
  if (!check.ok) return { ok: false, error: check.error };
  const { rule } = check;

  const timestampField = STATUS_TIMESTAMP[rule.to];

  let updated: Deal;
  try {
    updated = await db.$transaction(async (tx) => {
    // Re-read inside the transaction so two concurrent claims cannot both win.
    const fresh = await tx.deal.findUniqueOrThrow({ where: { id: dealId } });
    const recheck = checkTransition(transitionId, { deal: fresh, role });
    if (!recheck.ok) throw new TransitionConflict(recheck.error);

    const next = await tx.deal.update({
      where: { id: dealId },
      data: {
        status: rule.to,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
        ...(transitionId === 'claim' ? { middlemanId: user.id } : {}),
      },
    });

    await tx.transactionLog.create({
      data: {
        dealId,
        actorId: user.id,
        action: rule.action,
        fromStatus: fresh.status,
        toStatus: rule.to,
        metadata: {
          transition: rule.id,
          role,
          ...(extra?.metadata as Record<string, unknown> | undefined),
        },
      },
    });

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null, // system bot
        kind: 'SYSTEM',
        body: rule.systemMessage({ deal: next, role }),
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
