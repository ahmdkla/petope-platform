import type { CurrentUser } from './session';

type TicketParties = {
  id: string;
  openedById: string;
  assignedToId: string | null;
};

export type SupportRole = 'OPENER' | 'STAFF';

export type SupportAccess =
  | { allowed: true; role: SupportRole }
  | { allowed: false; role: null };

/**
 * The single permission check for anything support-scoped.
 *
 * Deliberately LOOSER than assertDealParticipant. A deal room is a closed
 * three-party space and an admin looking in writes an audit row. A support room
 * is the opposite: the whole point is that the team can pick one up, so any
 * middleman or admin may read and reply without being assigned first. There is
 * no escrow here and no money, so there is nothing to audit access to.
 *
 * Never hand-roll this check elsewhere.
 */
export function assertSupportParticipant(
  ticket: TicketParties,
  user: CurrentUser,
): SupportAccess {
  if (user.status !== 'ACTIVE') return { allowed: false, role: null };

  if (user.id === ticket.openedById) return { allowed: true, role: 'OPENER' };

  if (
    user.role === 'MIDDLEMAN' ||
    user.role === 'MAIN_MIDDLEMAN' ||
    user.role === 'ADMIN'
  ) {
    return { allowed: true, role: 'STAFF' };
  }

  return { allowed: false, role: null };
}
