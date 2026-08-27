/**
 * End-to-end exercise of the deal lifecycle engine.
 * Run: npx tsx scripts/test-lifecycle.ts
 *
 * NOTE: each run creates two deals and leaves them behind permanently. Deals
 * cannot be deleted once they have ledger rows (append-only trigger plus
 * onDelete: Restrict), so run this against a development database and use
 * `prisma migrate reset` when the test data gets in the way.
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { applyTransition, confirmMethod } from '../lib/deal-engine';
import type { CurrentUser } from '../lib/session';

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
}

async function user(email: string): Promise<CurrentUser> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    status: u.status,
  };
}

async function main() {
  const buyer = await user('buyer@exsaverse.demo');
  const seller = await user('seller@exsaverse.demo');
  const mm = await user('akla@exsaverse.demo');
  const otherMm = await user('rei@exsaverse.demo');
  const stranger = await user('nadia@exsaverse.demo');

  // Fresh deal for a clean run.
  const listing = await db.listing.findFirstOrThrow({ where: { side: 'SELL' } });
  const max = await db.deal.aggregate({ _max: { batchNumber: true } });
  const batch = (max._max.batchNumber ?? 0) + 1;

  const deal = await db.deal.create({
    data: {
      // Keeps test debris out of public feeds; deals cannot be deleted.
      isTest: true,
      reference: `${String(batch).padStart(2, '0')}-LIFECYCLE-TEST`,
      batchNumber: batch,
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      status: 'OPEN',
      projectName: 'Lifecycle Test',
      chain: 'Solana',
      dealAmount: 45_000_000n,
      mmFee: 0n,
      asset: 'USDC',
      quantity: 3,
      specific: 'GTD',
      priceType: 'FOR_EACH',
    },
  });
  console.log(`\nDeal ${deal.reference} created in OPEN\n`);

  console.log('ACCESS CONTROL');
  const strangerClaim = await applyTransition(deal.id, 'claim', stranger);
  // nadia is a MIDDLEMAN, so she MAY claim an unassigned deal — that is correct.
  check('a middleman may claim an unassigned deal', strangerClaim.ok);
  if (strangerClaim.ok) {
    // Undo so the rest of the run uses akla.
    await db.deal.update({
      where: { id: deal.id },
      data: { status: 'OPEN', middlemanId: null, claimedAt: null },
    });
  }

  console.log('\nWRONG-ORDER TRANSITIONS (guards must refuse)');
  const earlyLock = await applyTransition(deal.id, 'lock_terms', mm);
  check('lock_terms refused while OPEN', !earlyLock.ok, earlyLock.ok ? '' : earlyLock.error);

  const earlyPay = await applyTransition(deal.id, 'open_payment_window', mm);
  check('request payment refused while OPEN', !earlyPay.ok, earlyPay.ok ? '' : earlyPay.error);

  const buyerClaim = await applyTransition(deal.id, 'claim', buyer);
  check('buyer cannot claim', !buyerClaim.ok, buyerClaim.ok ? '' : buyerClaim.error);

  console.log('\nHAPPY PATH');
  const claimed = await applyTransition(deal.id, 'claim', mm);
  check('middleman claims -> CLAIMED', claimed.ok && claimed.deal.status === 'CLAIMED');

  const doubleClaim = await applyTransition(deal.id, 'claim', otherMm);
  check('second middleman cannot claim', !doubleClaim.ok, doubleClaim.ok ? '' : doubleClaim.error);

  console.log('\nMETHOD CONFIRMATION (both parties, never auto-derived)');
  const confirmNoMethod = await confirmMethod(deal.id, buyer, true);
  check(
    'cannot confirm before a method is proposed',
    !confirmNoMethod.ok,
    confirmNoMethod.ok ? '' : confirmNoMethod.error,
  );

  // The middleman proposes WALLET_SUBMIT with its money terms.
  await db.deal.update({
    where: { id: deal.id },
    data: {
      method: 'WALLET_SUBMIT',
      mmFee: 2_250_000n,
      collateralAmount: 7_000_000n,
      mintAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  console.log('  (middleman proposed WALLET_SUBMIT)');

  const lockNoConfirm = await applyTransition(deal.id, 'lock_terms', mm);
  check(
    'lock_terms refused with zero confirmations',
    !lockNoConfirm.ok,
    lockNoConfirm.ok ? '' : lockNoConfirm.error,
  );

  const buyerOk = await confirmMethod(deal.id, buyer, true);
  check('buyer confirms', buyerOk.ok);

  const lockOneConfirm = await applyTransition(deal.id, 'lock_terms', mm);
  check(
    'lock_terms still refused with only the buyer confirmed',
    !lockOneConfirm.ok,
    lockOneConfirm.ok ? '' : lockOneConfirm.error,
  );

  const mmConfirm = await confirmMethod(deal.id, mm, true);
  check(
    'middleman cannot confirm on a party\u2019s behalf',
    !mmConfirm.ok,
    mmConfirm.ok ? '' : mmConfirm.error,
  );

  const sellerOk = await confirmMethod(deal.id, seller, true);
  check('seller confirms', sellerOk.ok);

  console.log('\nMETHOD CHANGE RESETS CONFIRMATIONS');
  await db.deal.update({
    where: { id: deal.id },
    data: {
      method: 'OTC',
      methodConfirmedByBuyerAt: null,
      methodConfirmedBySellerAt: null,
      collateralAmount: null,
      mintAt: null,
    },
  });
  const lockAfterChange = await applyTransition(deal.id, 'lock_terms', mm);
  check(
    'lock_terms refused after the method changed',
    !lockAfterChange.ok,
    lockAfterChange.ok ? '' : lockAfterChange.error,
  );

  // Back to WALLET_SUBMIT, both confirm again.
  await db.deal.update({
    where: { id: deal.id },
    data: {
      method: 'WALLET_SUBMIT',
      collateralAmount: 7_000_000n,
      mintAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  await confirmMethod(deal.id, buyer, true);
  await confirmMethod(deal.id, seller, true);

  console.log('\nCONFIG-DRIVEN GUARDS');
  await db.deal.update({ where: { id: deal.id }, data: { collateralAmount: null } });
  const noCollateral = await applyTransition(deal.id, 'lock_terms', mm);
  check(
    'WALLET_SUBMIT requires collateral (from method config)',
    !noCollateral.ok,
    noCollateral.ok ? '' : noCollateral.error,
  );
  await db.deal.update({ where: { id: deal.id }, data: { collateralAmount: 7_000_000n } });

  await db.deal.update({ where: { id: deal.id }, data: { mintAt: null } });
  const noMint = await applyTransition(deal.id, 'lock_terms', mm);
  check(
    'WALLET_SUBMIT requires a mint date (from method config)',
    !noMint.ok,
    noMint.ok ? '' : noMint.error,
  );
  await db.deal.update({
    where: { id: deal.id },
    data: { mintAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
  });

  const locked = await applyTransition(deal.id, 'lock_terms', mm);
  check('lock_terms -> TERMS_LOCKED', locked.ok && locked.deal.status === 'TERMS_LOCKED');

  const paying = await applyTransition(deal.id, 'open_payment_window', mm);
  check(
    'request payment -> AWAITING_PAYMENT',
    paying.ok && paying.deal.status === 'AWAITING_PAYMENT',
  );

  console.log('\nSCOPE BOUNDARY (step 4 not built)');
  const beyond = await applyTransition(
    deal.id,
    'lock_terms',
    mm,
  );
  check(
    'no transition out of AWAITING_PAYMENT exists yet',
    !beyond.ok,
    beyond.ok ? '' : beyond.error,
  );

  console.log('\nCANCELLATION RULE');
  const cancelDeal = await db.deal.create({
    data: {
      // Keeps test debris out of public feeds; deals cannot be deleted.
      isTest: true,
      reference: `${String(batch + 1).padStart(2, '0')}-CANCEL-TEST`,
      batchNumber: batch + 1,
      buyerId: buyer.id,
      sellerId: seller.id,
      status: 'CLAIMED',
      middlemanId: mm.id,
      projectName: 'Cancel Test',
      chain: 'Solana',
      dealAmount: 10_000_000n,
      mmFee: 500_000n,
      asset: 'USDC',
      quantity: 1,
      specific: 'GTD',
      priceType: 'FOR_ALL',
      privateDataHandedOverAt: new Date(),
    },
  });
  const blockedCancel = await applyTransition(cancelDeal.id, 'cancel', buyer);
  check(
    'cancel refused after private data handover',
    !blockedCancel.ok,
    blockedCancel.ok ? '' : blockedCancel.error,
  );

  await db.deal.update({
    where: { id: cancelDeal.id },
    data: { privateDataHandedOverAt: null },
  });
  const okCancel = await applyTransition(cancelDeal.id, 'cancel', buyer);
  check('cancel allowed before handover', okCancel.ok && okCancel.deal.status === 'CANCELLED');

  console.log('\nAUDIT TRAIL');
  const logs = await db.transactionLog.findMany({
    where: { dealId: deal.id },
    orderBy: { createdAt: 'asc' },
    select: { action: true, fromStatus: true, toStatus: true, actorId: true },
  });
  console.log(
    '  ledger:',
    logs.map((l) => `${l.fromStatus ?? '-'}->${l.toStatus ?? '-'}:${l.action}`).join('  '),
  );
  // Four rows, not three: the first middleman's claim is legitimately recorded,
  // and the raw reset this script performed to hand the deal to akla did NOT
  // erase it. That is the append-only ledger behaving correctly — undoing a
  // transition means writing a compensating row, never deleting one.
  // PAYMENT_REQUESTED, not DEAL_FUNDED: opening the payment window is not the
  // same event as both payments being verified.
  const expected = [
    'DEAL_CLAIMED',
    'DEAL_CLAIMED',
    'TERMS_LOCKED',
    'PAYMENT_REQUESTED',
  ];
  check(
    'ledger records exactly the successful transitions',
    JSON.stringify(logs.map((l) => l.action)) === JSON.stringify(expected),
    logs.map((l) => l.action).join(','),
  );
  check('every ledger row names an actor', logs.every((l) => Boolean(l.actorId)));
  check(
    'refused transitions wrote nothing to the ledger',
    logs.length === expected.length,
    `${logs.length} rows after 9 refusals`,
  );
  check(
    'every transition row carries before and after state',
    logs.every((l) => Boolean(l.fromStatus) && Boolean(l.toStatus)),
  );

  const msgs = await db.dealMessage.findMany({
    where: { dealId: deal.id },
    orderBy: { createdAt: 'asc' },
    select: { kind: true, body: true, authorId: true },
  });
  console.log('  system messages:');
  for (const m of msgs) console.log(`    [${m.kind}] ${m.body}`);
  check('system messages posted for transitions', msgs.length >= 3);
  check('system messages have no author', msgs.every((m) => m.authorId === null));

  console.log('\nAUDIT_ACCESS on admin read');
  const admin = await user('admin@exsaverse.demo');
  const { assertDealParticipant } = await import('../lib/deal-access');
  const fresh = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  const before = await db.transactionLog.count({
    where: { dealId: deal.id, action: 'AUDIT_ACCESS' },
  });
  const adminAccess = await assertDealParticipant(fresh, admin);
  const after = await db.transactionLog.count({
    where: { dealId: deal.id, action: 'AUDIT_ACCESS' },
  });
  check('admin is granted access', adminAccess.allowed);
  check('admin access writes an AUDIT_ACCESS row', after === before + 1);

  await assertDealParticipant(fresh, buyer);
  const afterBuyer = await db.transactionLog.count({
    where: { dealId: deal.id, action: 'AUDIT_ACCESS' },
  });
  check('participant access writes no audit row', afterBuyer === after);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
