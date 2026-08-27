/**
 * End-to-end exercise of payment proofs and manual verification.
 * Run: npx tsx scripts/test-proofs.ts
 *
 * NOTE: creates a deal that cannot be deleted afterwards (append-only ledger).
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { applyTransition, confirmMethod } from '../lib/deal-engine';
import { paymentVerifier, SelfVerificationError } from '../lib/payments';
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
    id: u.id, email: u.email, displayName: u.displayName,
    avatarUrl: u.avatarUrl, role: u.role, status: u.status,
  };
}

async function main() {
  const buyer = await user('buyer@exsaverse.demo');
  const seller = await user('seller@exsaverse.demo');
  const mm = await user('akla@exsaverse.demo');

  const max = await db.deal.aggregate({ _max: { batchNumber: true } });
  const batch = (max._max.batchNumber ?? 0) + 1;

  // Drive a deal to AWAITING_PAYMENT on WALLET_SUBMIT (requires collateral).
  const deal = await db.deal.create({
    data: {
      reference: `${String(batch).padStart(2, '0')}-PROOF-TEST`,
      batchNumber: batch,
      buyerId: buyer.id, sellerId: seller.id, status: 'OPEN',
      projectName: 'Proof Test', chain: 'Solana',
      dealAmount: 45_000_000n, mmFee: 2_250_000n, asset: 'USDC',
      quantity: 3, specific: 'GTD', priceType: 'FOR_EACH',
    },
  });
  await applyTransition(deal.id, 'claim', mm);
  await db.deal.update({
    where: { id: deal.id },
    data: {
      method: 'WALLET_SUBMIT',
      collateralAmount: 7_000_000n,
      mintAt: new Date(Date.now() + 7 * 864e5),
    },
  });
  await confirmMethod(deal.id, buyer, true);
  await confirmMethod(deal.id, seller, true);
  await applyTransition(deal.id, 'lock_terms', mm);
  await applyTransition(deal.id, 'open_payment_window', mm);
  const atPayment = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  console.log(`\nDeal ${deal.reference} at ${atPayment.status}\n`);

  console.log('SUBMITTED PROOF ADVANCES NOTHING');
  const buyerProof = await paymentVerifier.submitProof({
    dealId: deal.id, submittedById: buyer.id, kind: 'BUYER_PAYMENT',
    reference: 'https://solscan.io/tx/DEMOBUYERPAYMENT111',
    claimedAmount: 47_250_000n, claimedAsset: 'USDC',
  });
  check('proof stored as SUBMITTED', buyerProof.status === 'SUBMITTED');
  const afterSubmit = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  check('deal status unchanged by submission', afterSubmit.status === 'AWAITING_PAYMENT');

  const fundEarly = await applyTransition(deal.id, 'mark_funded', mm);
  check('mark_funded refused on submitted-only proofs', !fundEarly.ok,
    fundEarly.ok ? '' : fundEarly.error);

  console.log('\nNO SELF-VERIFICATION');
  let selfErr: unknown = null;
  try {
    await paymentVerifier.verify({
      proofId: buyerProof.id, verifierId: buyer.id, decision: 'confirm',
    });
  } catch (e) {
    selfErr = e;
  }
  check('submitter cannot verify their own proof',
    selfErr instanceof SelfVerificationError,
    selfErr instanceof Error ? selfErr.message : 'no error thrown');

  // The database CHECK is the backstop behind the service-layer guard.
  let dbErr = '';
  try {
    await db.paymentProof.update({
      where: { id: buyerProof.id },
      data: { verifiedById: buyer.id, verifiedAt: new Date(), status: 'CONFIRMED' },
    });
  } catch (e) {
    dbErr = e instanceof Error ? e.message : String(e);
  }
  check('database CHECK blocks it even bypassing the service layer',
    dbErr.includes('payment_proof_no_self_verification'),
    dbErr.split('\n').find((l) => l.includes('constraint')) ?? dbErr.slice(0, 80));

  console.log('\nMIDDLEMAN CONFIRMATION ADVANCES STATE');
  const confirmBuyer = await paymentVerifier.verify({
    proofId: buyerProof.id, verifierId: mm.id, decision: 'confirm',
    note: 'Checked on Solscan, amount matches.',
  });
  check('buyer payment CONFIRMED', confirmBuyer.proof.status === 'CONFIRMED');
  check('verifier recorded on the proof', confirmBuyer.proof.verifiedById === mm.id);
  check('deal not yet funded (collateral outstanding)', !confirmBuyer.dealFunded);

  const fundHalf = await applyTransition(deal.id, 'mark_funded', mm);
  check('mark_funded still refused with only buyer payment confirmed',
    !fundHalf.ok, fundHalf.ok ? '' : fundHalf.error);

  console.log('\nREJECTION');
  const badCollateral = await paymentVerifier.submitProof({
    dealId: deal.id, submittedById: seller.id, kind: 'SELLER_COLLATERAL',
    reference: 'https://solscan.io/tx/WRONGAMOUNT999',
    claimedAmount: 7_000_000n, claimedAsset: 'USDC',
  });
  const rejected = await paymentVerifier.verify({
    proofId: badCollateral.id, verifierId: mm.id, decision: 'reject',
    note: 'Amount on chain is 3 USDC, not 7.',
  });
  check('proof REJECTED', rejected.proof.status === 'REJECTED');
  check('rejection does not fund the deal', !rejected.dealFunded);
  check('rejection note stored', rejected.proof.verifierNote?.includes('3 USDC') === true);

  let redecide = '';
  try {
    await paymentVerifier.verify({
      proofId: badCollateral.id, verifierId: mm.id, decision: 'confirm',
    });
  } catch (e) {
    redecide = e instanceof Error ? e.message : String(e);
  }
  check('a decided proof cannot be re-decided', redecide.includes('already been decided'),
    redecide.slice(0, 60));

  console.log('\nRESUBMISSION AND FUNDING');
  const goodCollateral = await paymentVerifier.submitProof({
    dealId: deal.id, submittedById: seller.id, kind: 'SELLER_COLLATERAL',
    reference: 'https://solscan.io/tx/GOODCOLLATERAL777',
    claimedAmount: 7_000_000n, claimedAsset: 'USDC',
  });
  check('rejected proof superseded by a new submission',
    goodCollateral.status === 'SUBMITTED');

  const confirmCollateral = await paymentVerifier.verify({
    proofId: goodCollateral.id, verifierId: mm.id, decision: 'confirm',
  });
  check('collateral CONFIRMED', confirmCollateral.proof.status === 'CONFIRMED');
  check('all required proofs confirmed -> dealFunded true', confirmCollateral.dealFunded);

  const funded = await applyTransition(deal.id, 'mark_funded', mm);
  check('mark_funded now allowed -> FUNDED', funded.ok && funded.deal.status === 'FUNDED');

  console.log('\nOTC NEEDS NO COLLATERAL (config-driven)');
  const otc = await db.deal.create({
    data: {
      reference: `${String(batch + 1).padStart(2, '0')}-OTC-TEST`,
      batchNumber: batch + 1,
      buyerId: buyer.id, sellerId: seller.id, status: 'AWAITING_PAYMENT',
      middlemanId: mm.id, method: 'OTC',
      projectName: 'OTC Test', chain: 'Solana',
      dealAmount: 20_000_000n, mmFee: 1_000_000n, asset: 'USDC',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
      termsLockedAt: new Date(),
    },
  });
  const otcProof = await paymentVerifier.submitProof({
    dealId: otc.id, submittedById: buyer.id, kind: 'BUYER_PAYMENT',
    reference: 'https://solscan.io/tx/OTCPAYMENT555',
    claimedAmount: 21_000_000n, claimedAsset: 'USDC',
  });
  const otcConfirm = await paymentVerifier.verify({
    proofId: otcProof.id, verifierId: mm.id, decision: 'confirm',
  });
  check('OTC funded on buyer payment alone', otcConfirm.dealFunded);
  const otcFunded = await applyTransition(otc.id, 'mark_funded', mm);
  check('OTC -> FUNDED', otcFunded.ok && otcFunded.deal.status === 'FUNDED');

  console.log('\nAUDIT TRAIL');
  const logs = await db.transactionLog.findMany({
    where: { dealId: deal.id },
    orderBy: { createdAt: 'asc' },
    select: { action: true, actorId: true, proofId: true, reference: true },
  });
  console.log('  ledger:', logs.map((l) => l.action).join('  '));

  const proofLogs = logs.filter((l) =>
    ['PROOF_SUBMITTED', 'PROOF_CONFIRMED', 'PROOF_REJECTED'].includes(l.action),
  );
  // 3 submissions (buyer payment, rejected collateral, replacement collateral)
  // + 3 decisions (confirm, reject, confirm) = 6.
  check('every proof event is in the ledger', proofLogs.length === 6,
    `${proofLogs.length} rows: ${proofLogs.map((l) => l.action).join(',')}`);
  check('every proof ledger row names an actor', proofLogs.every((l) => Boolean(l.actorId)));
  check('every proof ledger row links to its proof', proofLogs.every((l) => Boolean(l.proofId)));

  const decisions = logs.filter((l) =>
    ['PROOF_CONFIRMED', 'PROOF_REJECTED'].includes(l.action),
  );
  const verifierIds = await db.transactionLog.findMany({
    where: { dealId: deal.id, action: { in: ['PROOF_CONFIRMED', 'PROOF_REJECTED'] } },
    select: { actorId: true },
  });
  check('every confirm/reject names the verifying middleman',
    decisions.length === 3 && verifierIds.every((v) => v.actorId === mm.id),
    `${decisions.length} decisions`);

  check('DEAL_FUNDED written once', logs.filter((l) => l.action === 'DEAL_FUNDED').length === 1);
  check('PAYMENT_REQUESTED distinct from DEAL_FUNDED',
    logs.some((l) => l.action === 'PAYMENT_REQUESTED') &&
    logs.some((l) => l.action === 'DEAL_FUNDED'));

  console.log('\nSERVER NEVER FETCHES THE REFERENCE');
  const stored = await db.paymentProof.findUniqueOrThrow({ where: { id: buyerProof.id } });
  check('reference stored verbatim',
    stored.reference === 'https://solscan.io/tx/DEMOBUYERPAYMENT111', stored.reference);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
