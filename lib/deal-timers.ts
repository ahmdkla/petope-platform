import { db } from './db';
import { DEAL_METHOD_RULES } from './deal-methods';

/**
 * Release-timer processing.
 *
 * IMPORTANT: no timer here moves money or completes a deal. The platform never
 * moves money at all — a middleman does, off-platform. What these timers do is
 * change what the release guard REQUIRES:
 *
 *   - autoReleaseAt elapsing stops buyer silence from blocking a release the
 *     middleman still has to perform explicitly.
 *   - sellerDeliveryDeadline elapsing escalates to a dispute, because the
 *     method says the deal has failed and the buyer is owed the funds — which
 *     again a human has to send.
 *
 * See docs/DECISIONS.md: funding auto-advances from two explicit verifications,
 * release never does.
 *
 * This runs from an admin action today. The scheduled job (build-order step 6)
 * calls exactly this function — the indexed deadline columns exist for it.
 */
export type TimerOutcome = {
  dealId: string;
  reference: string;
  kind: 'seller_delivery_missed' | 'buyer_window_closed' | 'auto_release_eligible';
  detail: string;
};

export async function runDueTimers(
  /** Recorded against timer-driven ledger rows: the ledger has no anonymous entries. */
  actorId: string,
  now = new Date(),
): Promise<TimerOutcome[]> {
  const outcomes: TimerOutcome[] = [];

  // --- seller missed the delivery window: the deal has failed -------------
  const lateDeliveries = await db.deal.findMany({
    where: {
      status: 'AWAITING_CONFIRMATION',
      timersPausedAt: null,
      sellerDeliveryDeadline: { lte: now },
      receiptConfirmedAt: null,
    },
    select: { id: true, reference: true, method: true, sellerDeliveryDeadline: true },
  });

  for (const deal of lateDeliveries) {
    const hours = deal.method
      ? DEAL_METHOD_RULES[deal.method].sellerDeliveryDeadlineHours
      : null;
    const detail = `The seller did not deliver within ${hours ?? "the agreed"} hours of the mint. Per the method rules the deal has failed and the buyer is owed the funds.`;

    await db.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: 'DISPUTED',
          escalatedAt: now,
          escalationReason: detail,
          // Stop the clock: a disputed deal should not keep firing timers.
          timersPausedAt: now,
        },
      });

      await tx.transactionLog.create({
        data: {
          dealId: deal.id,
          actorId,
          action: 'DEAL_ESCALATED',
          fromStatus: 'AWAITING_CONFIRMATION',
          toStatus: 'DISPUTED',
          metadata: { trigger: 'sellerDeliveryDeadline', deadline: deal.sellerDeliveryDeadline?.toISOString() },
        },
      });

      await tx.dealMessage.create({
        data: { dealId: deal.id, authorId: null, kind: 'SYSTEM', body: detail },
      });
    });

    outcomes.push({
      dealId: deal.id,
      reference: deal.reference,
      kind: 'seller_delivery_missed',
      detail,
    });
  }

  // --- buyer confirmation window closed ------------------------------------
  const closedWindows = await db.deal.findMany({
    where: {
      status: 'AWAITING_CONFIRMATION',
      timersPausedAt: null,
      buyerConfirmDeadline: { lte: now },
      receiptConfirmedAt: null,
    },
    select: { id: true, reference: true },
  });

  for (const deal of closedWindows) {
    const detail =
      'The buyer\u2019s confirmation window has closed without a response. The middleman may proceed without it.';
    await notifyOnce(deal.id, detail);
    outcomes.push({
      dealId: deal.id,
      reference: deal.reference,
      kind: 'buyer_window_closed',
      detail,
    });
  }

  // --- buyer silence: release no longer blocked ----------------------------
  const silent = await db.deal.findMany({
    where: {
      status: 'AWAITING_CONFIRMATION',
      timersPausedAt: null,
      autoReleaseAt: { lte: now },
      receiptConfirmedAt: null,
    },
    select: { id: true, reference: true },
  });

  for (const deal of silent) {
    const detail =
      'The buyer did not respond within the agreed window. Their confirmation is no longer required for the middleman to release funds. The release itself is still a manual step.';
    await notifyOnce(deal.id, detail);
    outcomes.push({
      dealId: deal.id,
      reference: deal.reference,
      kind: 'auto_release_eligible',
      detail,
    });
  }

  return outcomes;
}

/** The bot posts a given notice at most once per deal. */
async function notifyOnce(dealId: string, body: string): Promise<void> {
  const existing = await db.dealMessage.findFirst({
    where: { dealId, kind: 'SYSTEM', body },
    select: { id: true },
  });
  if (existing) return;
  await db.dealMessage.create({ data: { dealId, authorId: null, kind: 'SYSTEM', body } });
}
