/**
 * End-to-end exercise of delivery, release, refund and timers.
 * Run: npx tsx scripts/test-release.ts
 *
 * NOTE: creates deals that cannot be deleted afterwards (append-only ledger).
 */
import 'dotenv/config';
import { db } from '../lib/db';
import {
  applyTransition, confirmMethod, declareHandover, confirmReceipt,
} from '../lib/deal-engine';
import { paymentVerifier } from '../lib/payments';
import { runDueTimers } from '../lib/deal-timers';
import type { CurrentUser } from '../lib/session';
import type { DealMethod } from '@prisma/client';

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

/** Drives a fresh deal all the way to FUNDED so each scenario starts clean. */
async function fundedDeal(opts: {
  label: string; method: DealMethod; collateral: bigint | null; mintPast?: boolean;
}) {
  const buyer = await user('kairo@exsaverse.demo');
  const seller = await user('dax@exsaverse.demo');
  const mm = await user('akla@exsaverse.demo');

  const max = await db.deal.aggregate({ _max: { batchNumber: true } });
  const batch = (max._max.batchNumber ?? 0) + 1;

  const deal = await db.deal.create({
    data: {
      // Keeps test debris out of public feeds; deals cannot be deleted.
      isTest: true,
      reference: `${String(batch).padStart(2, '0')}-${opts.label}`,
      batchNumber: batch, buyerId: buyer.id, sellerId: seller.id, status: 'OPEN',
      projectName: opts.label, chain: 'Solana',
      dealAmount: 45_000_000n, mmFee: 2_250_000n, asset: 'USDC',
      quantity: 1, specific: 'GTD', priceType: 'FOR_ALL',
    },
  });
  await applyTransition(deal.id, 'claim', mm);
  await db.deal.update({
    where: { id: deal.id },
    data: {
      method: opts.method,
      collateralAmount: opts.collateral,
      mintPrice: opts.method === 'MINT_FOR_YOU' ? 5_000_000n : null,
      mintAt: opts.mintPast
        ? new Date(Date.now() - 3600_000)
        : new Date(Date.now() + 7 * 864e5),
    },
  });
  await confirmMethod(deal.id, buyer, true);
  await confirmMethod(deal.id, seller, true);
  await applyTransition(deal.id, 'lock_terms', mm);
  await applyTransition(deal.id, 'open_payment_window', mm);

  const bp = await paymentVerifier.submitProof({
    dealId: deal.id, submittedById: buyer.id, kind: 'BUYER_PAYMENT',
    reference: `https://solscan.io/tx/${opts.label}BUY`, claimedAmount: 47_250_000n,
    claimedAsset: 'USDC',
  });
  await paymentVerifier.verify({ proofId: bp.id, verifierId: mm.id, decision: 'confirm' });

  if (opts.collateral) {
    const cp = await paymentVerifier.submitProof({
      dealId: deal.id, submittedById: seller.id, kind: 'SELLER_COLLATERAL',
      reference: `https://solscan.io/tx/${opts.label}COL`, claimedAmount: opts.collateral,
      claimedAsset: 'USDC',
    });
    await paymentVerifier.verify({ proofId: cp.id, verifierId: mm.id, decision: 'confirm' });
  }
  await applyTransition(deal.id, 'mark_funded', mm);
  return { deal, buyer, seller, mm };
}

async function main() {
  console.log('\nWALLET SURRENDER: private-data handover closes cancellation');
  {
    const { deal, buyer, seller, mm } = await fundedDeal({
      label: 'WSURR', method: 'WALLET_SURRENDER', collateral: 7_000_000n, mintPast: true,
    });

    const cancelBefore = await applyTransition(deal.id, 'cancel', buyer);
    check('cancel allowed while funded, before handover', cancelBefore.ok);
    // Put it back for the rest of the scenario.
    await db.deal.update({ where: { id: deal.id }, data: { status: 'FUNDED', cancelledAt: null } });

    const started = await applyTransition(deal.id, 'begin_delivery', mm);
    check('funded -> DELIVERING', started.ok && started.deal.status === 'DELIVERING');

    const early = await applyTransition(deal.id, 'complete_handover', mm);
    check('handover refused with no acknowledgements', !early.ok, early.ok ? '' : early.error);

    await declareHandover(deal.id, buyer, true);
    const half = await applyTransition(deal.id, 'complete_handover', mm);
    check('handover refused with only the buyer', !half.ok, half.ok ? '' : half.error);

    await declareHandover(deal.id, seller, true);
    const done = await applyTransition(deal.id, 'complete_handover', mm);
    check('handover -> AWAITING_MINT (method requires a mint)',
      done.ok && done.deal.status === 'AWAITING_MINT');
    check('privateDataHandedOverAt stamped', done.ok && done.deal.privateDataHandedOverAt !== null);

    const cancelAfter = await applyTransition(deal.id, 'cancel', buyer);
    check('cancel now refused', !cancelAfter.ok, cancelAfter.ok ? '' : cancelAfter.error);

    const minted = await applyTransition(deal.id, 'reach_mint', mm);
    check('mint -> AWAITING_CONFIRMATION', minted.ok && minted.deal.status === 'AWAITING_CONFIRMATION');
    check('autoReleaseAt resolved to an absolute time (24h rule)',
      minted.ok && minted.deal.autoReleaseAt !== null,
      minted.ok ? String(minted.deal.autoReleaseAt) : '');
    check('no buyerConfirmDeadline for this method',
      minted.ok && minted.deal.buyerConfirmDeadline === null);

    const noReceipt = await applyTransition(deal.id, 'release_funds', mm);
    check('release refused before buyer confirms', !noReceipt.ok, noReceipt.ok ? '' : noReceipt.error);

    await confirmReceipt(deal.id, buyer);
    const noProof = await applyTransition(deal.id, 'release_funds', mm);
    check('release refused without an MM_RELEASE record', !noProof.ok,
      noProof.ok ? '' : noProof.error);

    await paymentVerifier.submitProof({
      dealId: deal.id, submittedById: mm.id, kind: 'MM_RELEASE',
      reference: 'https://solscan.io/tx/WSURRRELEASE', claimedAmount: 45_000_000n,
      claimedAsset: 'USDC',
    });
    const stillMissing = await applyTransition(deal.id, 'release_funds', mm);
    check('release refused without the collateral return record', !stillMissing.ok,
      stillMissing.ok ? '' : stillMissing.error);

    await paymentVerifier.submitProof({
      dealId: deal.id, submittedById: mm.id, kind: 'MM_COLLATERAL_RETURN',
      reference: 'https://solscan.io/tx/WSURRCOL', claimedAmount: 7_000_000n,
      claimedAsset: 'USDC',
    });
    const released = await applyTransition(deal.id, 'release_funds', mm);
    check('release -> COMPLETED', released.ok && released.deal.status === 'COMPLETED');

    const logs = await db.transactionLog.findMany({
      where: { dealId: deal.id }, select: { action: true, amount: true },
      orderBy: { createdAt: 'asc' },
    });
    const actions = logs.map((l) => l.action);
    check('MM_FEE_TAKEN written on completion', actions.includes('MM_FEE_TAKEN'));
    check('COLLATERAL_RETURNED written on completion', actions.includes('COLLATERAL_RETURNED'));
    const fee = logs.find((l) => l.action === 'MM_FEE_TAKEN');
    check('fee row carries the amount', fee?.amount === 2_250_000n, String(fee?.amount));
  }

  console.log('\nOTC: no mint, no collateral, NFT handover is not private data');
  {
    const { deal, buyer, seller, mm } = await fundedDeal({
      label: 'OTCREL', method: 'OTC', collateral: null,
    });
    await applyTransition(deal.id, 'begin_delivery', mm);
    await declareHandover(deal.id, buyer, true);
    await declareHandover(deal.id, seller, true);
    const done = await applyTransition(deal.id, 'complete_handover', mm);
    check('OTC skips AWAITING_MINT -> AWAITING_CONFIRMATION',
      done.ok && done.deal.status === 'AWAITING_CONFIRMATION');
    check('NFT handover does NOT close cancellation',
      done.ok && done.deal.privateDataHandedOverAt === null);
    check('OTC has no timers (config has none)',
      done.ok && done.deal.autoReleaseAt === null &&
      done.deal.sellerDeliveryDeadline === null);

    await confirmReceipt(deal.id, buyer);
    await paymentVerifier.submitProof({
      dealId: deal.id, submittedById: mm.id, kind: 'MM_RELEASE',
      reference: 'https://solscan.io/tx/OTCRELEASE', claimedAmount: 45_000_000n,
      claimedAsset: 'USDC',
    });
    const released = await applyTransition(deal.id, 'release_funds', mm);
    check('OTC releases with no collateral record needed',
      released.ok && released.deal.status === 'COMPLETED');
    const actions = (await db.transactionLog.findMany({
      where: { dealId: deal.id }, select: { action: true },
    })).map((l) => l.action);
    check('no COLLATERAL_RETURNED for a collateral-free method',
      !actions.includes('COLLATERAL_RETURNED'));
  }

  console.log('\nBUYER SILENCE: window elapsing unblocks release, moves no money');
  {
    const { deal, buyer, mm } = await fundedDeal({
      label: 'SILENT', method: 'WALLET_SURRENDER', collateral: 7_000_000n, mintPast: true,
    });
    await applyTransition(deal.id, 'begin_delivery', mm);
    await declareHandover(deal.id, buyer, true);
    await declareHandover(deal.id, (await user('dax@exsaverse.demo')), true);
    await applyTransition(deal.id, 'complete_handover', mm);
    await applyTransition(deal.id, 'reach_mint', mm);

    const blocked = await applyTransition(deal.id, 'release_funds', mm);
    check('release blocked while the buyer window is open', !blocked.ok,
      blocked.ok ? '' : blocked.error);

    // Wind the stored deadline into the past, as the clock would.
    await db.deal.update({
      where: { id: deal.id }, data: { autoReleaseAt: new Date(Date.now() - 60_000) },
    });

    const outcomes = await runDueTimers(mm.id);
    const mine = outcomes.filter((o) => o.dealId === deal.id);
    check('timer run reports the deal as release-eligible',
      mine.some((o) => o.kind === 'auto_release_eligible'),
      mine.map((o) => o.kind).join(','));

    const afterTimer = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
    check('timer did NOT complete the deal by itself',
      afterTimer.status === 'AWAITING_CONFIRMATION', afterTimer.status);
    check('timer did NOT write a release to the ledger',
      !(await db.transactionLog.findFirst({
        where: { dealId: deal.id, action: 'FUNDS_RELEASED' },
      })));

    await paymentVerifier.submitProof({
      dealId: deal.id, submittedById: mm.id, kind: 'MM_RELEASE',
      reference: 'https://solscan.io/tx/SILENTREL', claimedAmount: 45_000_000n, claimedAsset: 'USDC',
    });
    await paymentVerifier.submitProof({
      dealId: deal.id, submittedById: mm.id, kind: 'MM_COLLATERAL_RETURN',
      reference: 'https://solscan.io/tx/SILENTCOL', claimedAmount: 7_000_000n, claimedAsset: 'USDC',
    });
    const released = await applyTransition(deal.id, 'release_funds', mm);
    check('middleman can now release without buyer confirmation',
      released.ok && released.deal.status === 'COMPLETED');
    check('buyer never confirmed receipt',
      released.ok && released.deal.receiptConfirmedAt === null);
  }

  console.log('\nSELLER MISSES DELIVERY WINDOW: timer escalates, moves no money');
  {
    const { deal, buyer, seller, mm } = await fundedDeal({
      label: 'LATE', method: 'MINT_FOR_YOU', collateral: 5_000_000n, mintPast: true,
    });
    await applyTransition(deal.id, 'begin_delivery', mm);
    await declareHandover(deal.id, buyer, true);
    await declareHandover(deal.id, seller, true);
    await applyTransition(deal.id, 'complete_handover', mm);
    const minted = await applyTransition(deal.id, 'reach_mint', mm);
    check('MINT_FOR_YOU sets a 6h seller delivery deadline',
      minted.ok && minted.deal.sellerDeliveryDeadline !== null);

    await db.deal.update({
      where: { id: deal.id },
      data: { sellerDeliveryDeadline: new Date(Date.now() - 60_000) },
    });
    const outcomes = await runDueTimers(mm.id);
    check('timer reports the missed delivery',
      outcomes.some((o) => o.dealId === deal.id && o.kind === 'seller_delivery_missed'));

    const after = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
    check('deal escalated to DISPUTED', after.status === 'DISPUTED', after.status);
    check('timers paused on the disputed deal', after.timersPausedAt !== null);
    check('no money moved by the timer',
      !(await db.transactionLog.findFirst({
        where: { dealId: deal.id, action: { in: ['FUNDS_RELEASED', 'REFUND_ISSUED'] } },
      })));

    console.log('\nREFUND: collateral forfeits per the method config');
    const admin = await user('admin@exsaverse.demo');
    const noProof = await applyTransition(deal.id, 'refund', admin);
    check('refund refused without an MM_REFUND record', !noProof.ok,
      noProof.ok ? '' : noProof.error);

    const asMm = await applyTransition(deal.id, 'refund', mm);
    check('assigned middleman cannot rule on the dispute alone', !asMm.ok,
      asMm.ok ? '' : asMm.error);

    await paymentVerifier.submitProof({
      dealId: deal.id, submittedById: admin.id, kind: 'MM_REFUND',
      reference: 'https://solscan.io/tx/LATEREFUND', claimedAmount: 52_250_000n,
      claimedAsset: 'USDC',
    });
    const refunded = await applyTransition(deal.id, 'refund', admin);
    check('refund -> REFUNDED', refunded.ok && refunded.deal.status === 'REFUNDED');

    const actions = (await db.transactionLog.findMany({
      where: { dealId: deal.id }, select: { action: true },
    })).map((l) => l.action);
    // MINT_FOR_YOU forfeits collateral to the buyer.
    check('COLLATERAL_FORFEITED written (config says forfeits to buyer)',
      actions.includes('COLLATERAL_FORFEITED'));
    check('collateral NOT returned to the seller', !actions.includes('COLLATERAL_RETURNED'));
    // The fee is NON-REFUNDABLE by default: the middleman did the work whatever
    // the outcome. Returning it requires the scammer exception in
    // app/admin/fee-refunds/, which is the only path that writes this action.
    check('MM fee NOT reversed by an ordinary refund',
      !actions.includes('MM_FEE_REFUNDED'));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
