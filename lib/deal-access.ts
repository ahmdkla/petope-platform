import { db } from './db';
import type { CurrentUser } from './session';

type DealParties = {
  id: string;
  buyerId: string;
  sellerId: string;
  middlemanId: string | null;
};

export type DealAccess =
  | { allowed: true; role: 'BUYER' | 'SELLER' | 'MIDDLEMAN' | 'ADMIN' }
  | { allowed: false; role: null };

/**
 * The single permission check for anything deal-scoped. Permissions are
 * per-deal, not global — never hand-roll this check somewhere else.
 *
 * A deal room contains exactly the buyer, the seller, and the assigned
 * middleman. Admin audit access is permitted but ALWAYS logged: an admin who is
 * not a participant writes an AUDIT_ACCESS row every time they look.
 */
export async function assertDealParticipant(
  deal: DealParties,
  user: CurrentUser,
  options: { audit?: boolean } = {},
): Promise<DealAccess> {
  const { audit = true } = options;

  if (user.status !== 'ACTIVE') return { allowed: false, role: null };

  if (user.id === deal.buyerId) return { allowed: true, role: 'BUYER' };
  if (user.id === deal.sellerId) return { allowed: true, role: 'SELLER' };
  if (user.id === deal.middlemanId) return { allowed: true, role: 'MIDDLEMAN' };

  /**
   * An UNCLAIMED deal is visible to any middleman — otherwise nobody could
   * ever claim one from the queue. This is not audit access: the deal has no
   * assigned middleman to be a non-participant of yet.
   */
  if (deal.middlemanId === null && isMiddlemanRole(user.role)) {
    return { allowed: true, role: 'MIDDLEMAN' };
  }

  if (user.role === 'ADMIN' || user.role === 'MAIN_MIDDLEMAN') {
    // Audit access is permitted but ALWAYS logged — except when the caller is
    // the engine, which passes audit:false because the page view that led here
    // has already written its row. Otherwise one page visit plus three button
    // presses would write four identical audit entries.
    if (audit) {
      await db.transactionLog.create({
        data: {
          dealId: deal.id,
          actorId: user.id,
          action: 'AUDIT_ACCESS',
          metadata: { role: user.role, reason: 'non-participant deal room access' },
        },
      });
    }
    return { allowed: true, role: 'ADMIN' };
  }

  return { allowed: false, role: null };
}

function isMiddlemanRole(role: string): boolean {
  return role === 'MIDDLEMAN' || role === 'MAIN_MIDDLEMAN' || role === 'ADMIN';
}
