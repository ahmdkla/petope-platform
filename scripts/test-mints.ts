/**
 * Mint schedule: a delay propagates only where release timers have not started.
 * Run: npx tsx scripts/test-mints.ts
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { createMintEventAsUser, rescheduleMintEventAsUser } from '../app/mints/actions';
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
  const run = Date.now().toString(36);
  const mm = await user('akla@exsaverse.demo');
  const member = await user('buyer@exsaverse.demo');
  const buyer = await user('buyer@exsaverse.demo');
  const seller = await user('seller@exsaverse.demo');

  console.log('\nACCESS');
  const byMember = await createMintEventAsUser(member, {
    projectName: `Blocked ${run}`, chain: 'Solana',
    mintAt: new Date(Date.now() + 7 * 864e5), note: null, projectLink: null,
  });
  check('an ordinary member cannot add an entry', !byMember.ok,
    byMember.ok ? '' : byMember.error);

  const created = await createMintEventAsUser(mm, {
    projectName: `Delayed Project ${run}`, chain: 'Solana',
    mintAt: new Date(Date.now() + 7 * 864e5), note: null, projectLink: null,
  });
  check('a middleman can add an entry', created.ok, created.ok ? '' : created.error);

  const event = await db.mintEvent.findFirstOrThrow({
    where: { projectName: `Delayed Project ${run}` },
  });
  const originalMint = event.mintAt;

  // Two linked deals: one still pre-timer, one already counting down.
  const max = await db.deal.aggregate({ _max: { batchNumber: true } });
  let batch = (max._max.batchNumber ?? 0) + 1;

  const preTimer = await db.deal.create({
    data: {
      reference: `${batch}-MINT-PRE-${run}`.toUpperCase(), batchNumber: batch++,
      buyerId: buyer.id, sellerId: seller.id, middlemanId: mm.id,
      status: 'AWAITING_PAYMENT', method: 'WALLET_SURRENDER',
      projectName: event.projectName, chain: 'Solana',
      dealAmount: 45_000_000n, mmFee: 2_250_000n, asset: 'STABLE',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
      mintAt: originalMint, mintEventId: event.id, isTest: true,
    },
  });

  const running = await db.deal.create({
    data: {
      reference: `${batch}-MINT-RUN-${run}`.toUpperCase(), batchNumber: batch++,
      buyerId: buyer.id, sellerId: seller.id, middlemanId: mm.id,
      status: 'AWAITING_CONFIRMATION', method: 'WALLET_SURRENDER',
      projectName: event.projectName, chain: 'Solana',
      dealAmount: 45_000_000n, mmFee: 2_250_000n, asset: 'STABLE',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
      mintAt: originalMint, mintEventId: event.id, isTest: true,
      // Resolved when the timer started.
      autoReleaseAt: new Date(Date.now() + 24 * 3600_000),
    },
  });
  const runningDeadline = running.autoReleaseAt!;

  console.log('\nTHE PROJECT DELAYS');
  const newMint = new Date(originalMint.getTime() + 21 * 864e5);
  const moved = await rescheduleMintEventAsUser(
    mm, event.id, newMint, 'Project announced a three-week delay.',
  );
  check('a middleman can reschedule', moved.ok, moved.ok ? '' : moved.error);
  if (!moved.ok) process.exit(1);

  check('exactly one deal was updated', moved.updated === 1, `${moved.updated}`);
  check('exactly one deal was left alone', moved.skipped === 1, `${moved.skipped}`);

  const preAfter = await db.deal.findUniqueOrThrow({ where: { id: preTimer.id } });
  check('the pre-timer deal follows the new date',
    preAfter.mintAt?.getTime() === newMint.getTime());

  const runAfter = await db.deal.findUniqueOrThrow({ where: { id: running.id } });
  check('the running deal keeps its mint date',
    runAfter.mintAt?.getTime() === originalMint.getTime());
  check('and its resolved deadline is untouched',
    runAfter.autoReleaseAt?.getTime() === runningDeadline.getTime());

  console.log('\nBOTH ROOMS ARE TOLD');
  const preMsg = await db.dealMessage.findFirst({
    where: { dealId: preTimer.id, kind: 'SYSTEM' }, orderBy: { createdAt: 'desc' },
  });
  check('the updated room is told its date moved',
    preMsg?.body.includes('has been updated') === true, preMsg?.body.slice(0, 60));

  const runMsg = await db.dealMessage.findFirst({
    where: { dealId: running.id, kind: 'SYSTEM' }, orderBy: { createdAt: 'desc' },
  });
  check('the frozen room is told why it did not move',
    runMsg?.body.includes('deadlines are unchanged') === true, runMsg?.body.slice(0, 60));

  console.log('\nAUDIT');
  const log = await db.transactionLog.findFirst({
    where: { actorId: mm.id, action: 'ADMIN_OVERRIDE' }, orderBy: { createdAt: 'desc' },
  });
  const meta = log?.metadata as
    | { action?: string; dealsUpdated?: number; dealsFrozen?: number }
    | null;
  check('the reschedule is in the ledger', meta?.action === 'mint_rescheduled');
  check('with the counts recorded',
    meta?.dealsUpdated === 1 && meta?.dealsFrozen === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
