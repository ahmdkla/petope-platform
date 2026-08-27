/**
 * MM fee: computation, the client-cannot-set rule, and the refund exception.
 * Run: npx tsx scripts/test-fee.ts
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { computeMmFee } from '../lib/mm-fee';
import { getMmFeeConfig } from '../lib/admin-settings';
import { applyTransition, confirmMethod } from '../lib/deal-engine';
import { proposeTermsAsUser } from '../app/deals/[id]/actions';
import { refundMmFeeAsUser } from '../app/admin/fee-refunds/actions';
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
  const cfg = await getMmFeeConfig();
  console.log(`\nconfig: ${cfg.percentBasisPoints / 100}%  floors USDC=${cfg.floor.USDC} SOL=${cfg.floor.SOL}  window=${cfg.refundWindowHours}h\n`);

  console.log('COMPUTATION');
  {
    // 500 + 200 = 700 USDC base; 5% = 35 USDC, well above the $5 floor.
    const r = computeMmFee(
      { dealAmount: 500_000_000n, collateral: 200_000_000n, asset: 'USDC' }, cfg);
    check('base is dealAmount + collateral', r.base === 700_000_000n, String(r.base));
    check('fee is 5% of the base', r.fee === 35_000_000n, String(r.fee));
    check('not at the floor', !r.atFloor);
    check('buyer pays deal amount + fee (not collateral)',
      r.buyerPays === 535_000_000n, String(r.buyerPays));
  }
  {
    // $10 deal, no collateral: 5% = $0.50, below the $5 floor.
    const r = computeMmFee({ dealAmount: 10_000_000n, collateral: null, asset: 'USDC' }, cfg);
    check('floor applies when the percentage is lower', r.fee === cfg.floor.USDC, String(r.fee));
    check('atFloor flagged', r.atFloor);
  }
  {
    const solSmall = computeMmFee({ dealAmount: sol(0.1), collateral: null, asset: 'SOL' }, cfg);
    check('SOL uses its own floor, not the USDC one',
      solSmall.fee === cfg.floor.SOL, String(solSmall.fee));
    const usdcSmall = computeMmFee({ dealAmount: 10_000_000n, collateral: null, asset: 'USDC' }, cfg);
    check('the two floors differ', solSmall.fee !== usdcSmall.fee);
  }
  {
    const withCol = computeMmFee({ dealAmount: 100_000_000n, collateral: 100_000_000n, asset: 'USDC' }, cfg);
    const without = computeMmFee({ dealAmount: 100_000_000n, collateral: null, asset: 'USDC' }, cfg);
    check('collateral raises the fee', withCol.fee > without.fee,
      `${without.fee} -> ${withCol.fee}`);
  }

  function sol(n: number) { return BigInt(Math.round(n * 1_000_000_000)); }

  console.log('\nTHE CLIENT CANNOT SET THE FEE');
  const buyer = await user('buyer@exsaverse.demo');
  const seller = await user('seller@exsaverse.demo');
  const mm = await user('akla@exsaverse.demo');

  const max = await db.deal.aggregate({ _max: { batchNumber: true } });
  const batch = (max._max.batchNumber ?? 0) + 1;
  const deal = await db.deal.create({
    data: {
      reference: `${String(batch).padStart(2, '0')}-FEE-TEST`,
      batchNumber: batch, buyerId: buyer.id, sellerId: seller.id, status: 'OPEN',
      projectName: 'Fee Test', chain: 'Solana',
      dealAmount: 400_000_000n, mmFee: 0n, asset: 'USDC',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
    },
  });
  await applyTransition(deal.id, 'claim', mm);

  // Send an absurd fee alongside valid terms. It must be ignored entirely.
  const res = await proposeTermsAsUser(mm, deal.id, {
    method: 'WALLET_SUBMIT',
    mmFee: 1n, // <- attacker-supplied
    collateralAmount: 100_000_000n,
    mintPrice: null,
    mintAt: new Date(Date.now() + 7 * 864e5),
  });
  check('proposeTerms accepted the request', res.ok, res.ok ? '' : res.error);

  const afterTerms = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  const expected = computeMmFee(
    { dealAmount: 400_000_000n, collateral: 100_000_000n, asset: 'USDC' }, cfg).fee;
  check('a client-supplied fee is ignored', afterTerms.mmFee !== 1n, String(afterTerms.mmFee));
  check('the stored fee is the computed one', afterTerms.mmFee === expected,
    `${afterTerms.mmFee} vs ${expected}`);

  console.log('\nRECOMPUTED ON CHANGE, FROZEN AT LOCK');
  await proposeTermsAsUser(mm, deal.id, {
    method: 'WALLET_SUBMIT',
    collateralAmount: 300_000_000n,
    mintPrice: null,
    mintAt: new Date(Date.now() + 7 * 864e5),
  });
  const afterRaise = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  check('raising the collateral raises the fee', afterRaise.mmFee > afterTerms.mmFee,
    `${afterTerms.mmFee} -> ${afterRaise.mmFee}`);

  await confirmMethod(deal.id, buyer, true);
  await confirmMethod(deal.id, seller, true);
  await applyTransition(deal.id, 'lock_terms', mm);
  const locked = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });

  const afterLock = await proposeTermsAsUser(mm, deal.id, {
    method: 'WALLET_SUBMIT',
    collateralAmount: 900_000_000n,
    mintPrice: null,
    mintAt: new Date(Date.now() + 7 * 864e5),
  });
  check('terms cannot be changed after locking', !afterLock.ok,
    afterLock.ok ? '' : afterLock.error);
  const stillLocked = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  check('the fee is frozen at lock', stillLocked.mmFee === locked.mmFee);

  console.log('\nNON-REFUNDABLE BY DEFAULT');
  const admin = await user('admin@exsaverse.demo');

  // A deal that closed just now, so it is inside the window.
  const closed = await db.deal.create({
    data: {
      reference: `${String(batch + 1).padStart(2, '0')}-FEE-CLOSED`,
      batchNumber: batch + 1, buyerId: buyer.id, sellerId: seller.id,
      middlemanId: mm.id, method: 'OTC', status: 'COMPLETED',
      projectName: 'Fee Closed', chain: 'Solana',
      dealAmount: 200_000_000n, mmFee: 10_000_000n, asset: 'USDC',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
      completedAt: new Date(),
    },
  });

  // The ordinary refund path must leave the fee alone.
  const disputed = await db.deal.create({
    data: {
      reference: `${String(batch + 2).padStart(2, '0')}-FEE-DISPUTE`,
      batchNumber: batch + 2, buyerId: buyer.id, sellerId: seller.id,
      middlemanId: mm.id, method: 'OTC', status: 'DISPUTED',
      projectName: 'Fee Dispute', chain: 'Solana',
      dealAmount: 200_000_000n, mmFee: 10_000_000n, asset: 'USDC',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
    },
  });
  await db.paymentProof.create({
    data: { dealId: disputed.id, kind: 'MM_REFUND', submittedById: admin.id,
      reference: 'https://solscan.io/tx/FEEREFUNDPATH', status: 'SUBMITTED' },
  });
  const refunded = await applyTransition(disputed.id, 'refund', admin);
  check('ordinary refund succeeds', refunded.ok, refunded.ok ? '' : refunded.error);
  const feeRows = await db.transactionLog.count({
    where: { dealId: disputed.id, action: 'MM_FEE_REFUNDED' },
  });
  check('ordinary refund does NOT return the fee', feeRows === 0, `${feeRows} rows`);

  console.log('\nTHE SCAMMER EXCEPTION');
  // akla is MAIN_MIDDLEMAN and IS permitted; the restriction bites on an
  // ordinary middleman.
  const plainMm = await user('rei@exsaverse.demo');
  const asMm = await refundMmFeeAs(plainMm, closed.id, 'Buyer turned out to be a known scammer.');
  check('an ordinary middleman cannot refund the fee', !asMm.ok, asMm.ok ? '' : asMm.error);

  const asMainMm = await refundMmFeeAs(mm, closed.id, 'Checking that a main middleman is allowed.');
  check('a MAIN_MIDDLEMAN is permitted', asMainMm.ok, asMainMm.ok ? '' : asMainMm.error);

  const noReason = await refundMmFeeAs(admin, closed.id, 'too short');
  check('a reason is required', !noReason.ok, noReason.ok ? '' : noReason.error);

  const closed2 = await db.deal.create({
    data: {
      reference: `${String(batch + 4).padStart(2, '0')}-FEE-ADMIN`,
      batchNumber: batch + 4, buyerId: buyer.id, sellerId: seller.id,
      middlemanId: mm.id, method: 'OTC', status: 'COMPLETED',
      projectName: 'Fee Admin', chain: 'Solana',
      dealAmount: 200_000_000n, mmFee: 10_000_000n, asset: 'USDC',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
      completedAt: new Date(),
    },
  });
  const ok = await refundMmFeeAs(admin, closed2.id,
    'Seller was a confirmed scammer; buyer reported within the hour.');
  check('admin can refund inside the window with a reason', ok.ok, ok.ok ? '' : ok.error);

  const row = await db.transactionLog.findFirst({
    where: { dealId: closed2.id, action: 'MM_FEE_REFUNDED' },
  });
  check('MM_FEE_REFUNDED written', Boolean(row));
  check('it names the actor', row?.actorId === admin.id);
  check('it carries the amount', row?.amount === 10_000_000n, String(row?.amount));
  check('the reason is recorded',
    JSON.stringify(row?.metadata ?? {}).includes('confirmed scammer'));

  const twice = await refundMmFeeAs(admin, closed2.id, 'Trying the very same thing again.');
  check('it cannot be refunded twice', !twice.ok, twice.ok ? '' : twice.error);

  // Outside the window.
  const old = await db.deal.create({
    data: {
      reference: `${String(batch + 3).padStart(2, '0')}-FEE-OLD`,
      batchNumber: batch + 3, buyerId: buyer.id, sellerId: seller.id,
      middlemanId: mm.id, method: 'OTC', status: 'COMPLETED',
      projectName: 'Fee Old', chain: 'Solana',
      dealAmount: 200_000_000n, mmFee: 10_000_000n, asset: 'USDC',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
      completedAt: new Date(Date.now() - 48 * 3_600_000),
    },
  });
  const late = await refundMmFeeAs(admin, old.id, 'Reported two days after the deal closed.');
  check('outside the window it is refused', !late.ok, late.ok ? '' : late.error);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

function refundMmFeeAs(actor: CurrentUser, dealId: string, reason: string) {
  return refundMmFeeAsUser(actor, { dealId, reason });
}

main().catch((e) => { console.error(e); process.exit(1); });
