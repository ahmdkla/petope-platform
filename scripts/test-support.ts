/**
 * Support rooms: access, append-only transcript, no escrow.
 * Run: npx tsx scripts/test-support.ts
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { assertSupportParticipant } from '../lib/support-access';
import {
  openTicketAsUser,
  postSupportMessageAsUser,
  setTicketStatusAsUser,
} from '../app/support/actions';
import type { CurrentUser } from '../lib/session';

let pass = 0, fail = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++; else fail++;
}
async function user(email: string): Promise<CurrentUser> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, email: u.email, displayName: u.displayName,
    avatarUrl: u.avatarUrl, role: u.role, status: u.status };
}

async function main() {
  const opener = await user('kairo@exsaverse.demo');
  const stranger = await user('mirae@exsaverse.demo');
  const mm = await user('rei@exsaverse.demo');
  const admin = await user('admin@exsaverse.demo');

  console.log('\nOPENING');
  const opened = await openTicketAsUser(opener, {
    category: 'ACCOUNT_ISSUE',
    subject: 'Cannot update my display name',
    body: 'Saving the profile form does nothing and no error appears.',
  });
  check('a member can open a room', opened.ok, opened.ok ? '' : opened.error);
  if (!opened.ok) process.exit(1);
  const ticketId = opened.ticketId;

  const ticket = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
  check('starts OPEN and unassigned', ticket.status === 'OPEN' && ticket.assignedToId === null);

  const msgs = await db.supportMessage.findMany({ where: { ticketId }, orderBy: { createdAt: 'asc' } });
  check('the opening message plus a system note', msgs.length === 2, `${msgs.length}`);
  check('system message has no author', msgs.some((m) => m.kind === 'SYSTEM' && m.authorId === null));

  console.log('\nACCESS');
  check('opener may read', assertSupportParticipant(ticket, opener).allowed);
  check('an unrelated member may NOT read', !assertSupportParticipant(ticket, stranger).allowed);
  check('any middleman may read', assertSupportParticipant(ticket, mm).allowed);
  check('an admin may read', assertSupportParticipant(ticket, admin).allowed);
  check(
    'staff are identified as STAFF, not as the opener',
    assertSupportParticipant(ticket, mm).role === 'STAFF',
  );

  const strangerPost = await postSupportMessageAsUser(stranger, ticketId, 'let me in');
  check('an unrelated member cannot post', !strangerPost.ok, strangerPost.ok ? '' : strangerPost.error);

  console.log('\nSTAFF PICKUP');
  const staffReply = await postSupportMessageAsUser(mm, ticketId, 'Looking at it now.');
  check('a middleman can reply', staffReply.ok, staffReply.ok ? '' : staffReply.error);

  const afterReply = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
  check('first staff reply claims the room', afterReply.assignedToId === mm.id);
  check('status moves to ASSIGNED', afterReply.status === 'ASSIGNED', afterReply.status);

  console.log('\nSTATUS');
  const memberResolve = await setTicketStatusAsUser(opener, ticketId, 'RESOLVED');
  check('the opener cannot mark it resolved', !memberResolve.ok,
    memberResolve.ok ? '' : memberResolve.error);

  const staffResolve = await setTicketStatusAsUser(mm, ticketId, 'RESOLVED');
  check('staff can mark it resolved', staffResolve.ok, staffResolve.ok ? '' : staffResolve.error);

  const closed = await setTicketStatusAsUser(opener, ticketId, 'CLOSED');
  check('the opener can close their own room', closed.ok, closed.ok ? '' : closed.error);

  const postAfterClose = await postSupportMessageAsUser(opener, ticketId, 'one more thing');
  check('a closed room takes no new messages', !postAfterClose.ok,
    postAfterClose.ok ? '' : postAfterClose.error);

  console.log('\nNO ESCROW ATTACHED');
  const proofs = await db.paymentProof.count({ where: { deal: { reference: ticket.reference } } });
  check('no payment proofs exist against a support room', proofs === 0);
  const ledger = await db.transactionLog.count({
    where: { metadata: { path: ['ticketId'], equals: ticketId } },
  });
  check('support activity writes nothing to the money ledger', ledger === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
