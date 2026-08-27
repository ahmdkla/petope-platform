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
): Promise<DealAccess> {
  if (user.status !== 'ACTIVE') return { allowed: false, role: null };

  if (user.id === deal.buyerId) return { allowed: true, role: 'BUYER' };
  if (user.id === deal.sellerId) return { allowed: true, role: 'SELLER' };
  if (user.id === deal.middlemanId) return { allowed: true, role: 'MIDDLEMAN' };

  if (user.role === 'ADMIN' || user.role === 'MAIN_MIDDLEMAN') {
    await db.transactionLog.create({
      data: {
        dealId: deal.id,
        actorId: user.id,
        action: 'AUDIT_ACCESS',
        metadata: { role: user.role, reason: 'non-participant deal room access' },
      },
    });
    return { allowed: true, role: 'ADMIN' };
  }

  return { allowed: false, role: null };
}
