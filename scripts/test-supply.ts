/**
 * Concurrent deals, partial purchase, spot reservation and SOLD_OUT.
 * Run: npx tsx scripts/test-supply.ts
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { quickDealAsUser } from '../app/listings/actions';
import { applyTransition, confirmMethod } from '../lib/deal-engine';
import { paymentVerifier } from '../lib/payments';
import { getListingDemand } from '../lib/listing-demand';
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

/** Drives an existing open deal all the way to FUNDED. */
async function fund(dealId: string, mm: CurrentUser, buyer: CurrentUser, seller: CurrentUser) {
  const d = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (!d.middlemanId) await applyTransition(dealId, 'claim', mm);
  await db.deal.update({
    where: { id: dealId },
    data: { method: 'OTC', collateralAmount: null, mmFee: 5_000_000n },
  });
  await confirmMethod(dealId, buyer, true);
  await confirmMethod(dealId, seller, true);
  await applyTransition(dealId, 'lock_terms', mm);
  await applyTransition(dealId, 'open_payment_window', mm);
  const p = await paymentVerifier.submitProof({
    dealId, submittedById: buyer.id, kind: 'BUYER_PAYMENT',
    reference: `https://solscan.io/tx/SUP${dealId.slice(-8)}`,
    claimedAmount: d.dealAmount, claimedAsset: d.asset,
  });
  await paymentVerifier.verify({ proofId: p.id, verifierId: mm.id, decision: 'confirm' });
  return applyTransition(dealId, 'mark_funded', mm);
}

async function makeListing(opts: {
  item: string; quantity: number; priceType: 'FOR_EACH' | 'FOR_ALL'; sellerId: string;
}) {
  return db.listing.create({
    data: {
      side: 'SELL', authorId: opts.sellerId, item: opts.item, chain: 'Solana',
      price: 10_000_000n, priceType: opts.priceType, payment: 'USDC',
      specific: 'GTD', type: 'TOKEN_TRANSFER',
      quantity: opts.quantity, quantityRemaining: opts.quantity, status: 'ACTIVE',
      // Keeps fixtures out of the public marketplace; listings referenced by a
      // deal cannot be deleted.
      isTest: true,
    },
  });
}

async function main() {
  const run = Date.now().toString(36);
  const seller = await user('seller2@exsaverse.demo');
  const mm = await user('akla@exsaverse.demo');
  const buyers = await Promise.all([
    user('buyer@exsaverse.demo'), user('buyer2@exsaverse.demo'),
    user('buyer3@exsaverse.demo'),
  ]);

  console.log('\nCONCURRENCY LIMIT AND ONE DEAL PER USER');
  {
    const listing = await makeListing({
      item: `Supply Concurrency ${run}`, quantity: 20, priceType: 'FOR_EACH', sellerId: seller.id,
    });

    // Nine distinct buyers, so the cap is what bites rather than the per-user rule.
    const extra: CurrentUser[] = [];
    for (let i = 0; i < 9; i++) {
      // Unique per run: these rows cannot be deleted afterwards once they
      // touch a deal, so a fixed address would collide on the second run.
      const email = `supplybuyer${i}.${run}@exsaverse.demo`;
      const u = await db.user.create({
        data: { email, displayName: `supply_${i}`, termsAcceptedAt: new Date() },
      });
      extra.push({ id: u.id, email, displayName: u.displayName,
        avatarUrl: null, role: u.role, status: u.status });
    }

    const results = [];
    for (const b of extra) results.push(await quickDealAsUser(b, listing.id, 1));
    const okCount = results.filter((r) => r.ok).length;
    check('7 concurrent deals allowed', okCount === 7, `${okCount} succeeded`);
    check('the 8th is refused', !results[7].ok, results[7].ok ? '' : results[7].error);

    const dup = await quickDealAsUser(extra[0], listing.id, 1);
    check('the same user cannot open a second deal', !dup.ok, dup.ok ? '' : dup.error);

    const after = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    check('open deals reserve nothing', after.quantityRemaining === 20,
      `${after.quantityRemaining} remaining`);
    check('the listing is still ACTIVE', after.status === 'ACTIVE');
  }

  console.log('\nPARTIAL PURCHASE');
  {
    const each = await makeListing({
      item: `Supply Partial ${run}`, quantity: 6, priceType: 'FOR_EACH', sellerId: seller.id,
    });
    const partial = await quickDealAsUser(buyers[0], each.id, 4);
    check('for-each allows a partial purchase', partial.ok, partial.ok ? '' : partial.error);

    const tooMany = await quickDealAsUser(buyers[1], each.id, 99);
    check('more than remaining is refused', !tooMany.ok, tooMany.ok ? '' : tooMany.error);

    const all = await makeListing({
      item: `Supply All Or Nothing ${run}`, quantity: 3, priceType: 'FOR_ALL', sellerId: seller.id,
    });
    const split = await quickDealAsUser(buyers[0], all.id, 1);
    check('for-all cannot be split', !split.ok, split.ok ? '' : split.error);
    const whole = await quickDealAsUser(buyers[0], all.id, 3);
    check('for-all accepts every remaining spot', whole.ok, whole.ok ? '' : whole.error);
  }

  console.log('\nRESERVATION AT FUNDING, AND SOLD_OUT');
  {
    const listing = await makeListing({
      item: `Supply Reserve ${run}`, quantity: 4, priceType: 'FOR_EACH', sellerId: seller.id,
    });

    const a = await quickDealAsUser(buyers[0], listing.id, 3);
    const b = await quickDealAsUser(buyers[1], listing.id, 3);
    check('two deals for 3 of 4 spots both open', a.ok && b.ok);

    const demand = await getListingDemand(listing.id);
    check('demand reports the oversubscription',
      demand.oversubscribed && demand.spotsInFlight === 6 && demand.quantityRemaining === 4,
      `${demand.spotsInFlight} in flight vs ${demand.quantityRemaining} left`);

    const dealA = await db.deal.findFirstOrThrow({
      where: { listingId: listing.id, buyerId: buyers[0].id },
    });
    const dealB = await db.deal.findFirstOrThrow({
      where: { listingId: listing.id, buyerId: buyers[1].id },
    });

    const fundedA = await fund(dealA.id, mm, buyers[0], seller);
    check('the first deal funds', fundedA.ok, fundedA.ok ? '' : fundedA.error);
    check('spotsReservedAt stamped', fundedA.ok && fundedA.deal.spotsReservedAt !== null);

    const l1 = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    check('supply decremented at funding', l1.quantityRemaining === 1,
      `${l1.quantityRemaining} remaining`);

    // The second deal wants 3 but only 1 is left.
    const fundedB = await fund(dealB.id, mm, buyers[1], seller);
    check('the second deal is REFUSED at funding, not oversold', !fundedB.ok,
      fundedB.ok ? '' : fundedB.error);
    check('the refusal names the shortfall',
      !fundedB.ok && fundedB.error.includes('1'), fundedB.ok ? '' : fundedB.error);

    const l2 = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    check('supply unchanged by the refused funding', l2.quantityRemaining === 1);
  }

  console.log('\nSOLD OUT AND RELEASE');
  {
    const listing = await makeListing({
      item: `Supply Sold Out ${run}`, quantity: 2, priceType: 'FOR_EACH', sellerId: seller.id,
    });
    const opened = await quickDealAsUser(buyers[2], listing.id, 2);
    check('a deal for every spot opens', opened.ok, opened.ok ? '' : opened.error);

    const deal = await db.deal.findFirstOrThrow({
      where: { listingId: listing.id, buyerId: buyers[2].id },
    });
    const funded = await fund(deal.id, mm, buyers[2], seller);
    check('funding the last spots succeeds', funded.ok, funded.ok ? '' : funded.error);

    const sold = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    check('listing is SOLD_OUT at zero', sold.status === 'SOLD_OUT', sold.status);
    check('quantityRemaining is zero', sold.quantityRemaining === 0);

    const blocked = await quickDealAsUser(buyers[0], listing.id, 1);
    check('a sold-out listing takes no new deals', !blocked.ok,
      blocked.ok ? '' : blocked.error);

    // Refund it and the spots come back.
    await applyTransition(deal.id, 'escalate', mm);
    const admin = await user('admin@exsaverse.demo');
    await db.paymentProof.create({
      data: { dealId: deal.id, kind: 'MM_REFUND', submittedById: admin.id,
        reference: 'https://solscan.io/tx/SUPPLYREFUND', status: 'SUBMITTED' },
    });
    const refunded = await applyTransition(deal.id, 'refund', admin);
    check('the funded deal is refunded', refunded.ok, refunded.ok ? '' : refunded.error);
    check('spotsReservedAt cleared', refunded.ok && refunded.deal.spotsReservedAt === null);

    const reopened = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    check('spots returned to the listing', reopened.quantityRemaining === 2,
      `${reopened.quantityRemaining} remaining`);
    check('listing reopened to ACTIVE', reopened.status === 'ACTIVE', reopened.status);
  }

  console.log('\nCANCELLING AN UNFUNDED DEAL INVENTS NO SUPPLY');
  {
    const listing = await makeListing({
      item: `Supply Cancel ${run}`, quantity: 5, priceType: 'FOR_EACH', sellerId: seller.id,
    });
    const opened = await quickDealAsUser(buyers[0], listing.id, 2);
    check('deal opens', opened.ok, opened.ok ? '' : opened.error);
    const deal = await db.deal.findFirstOrThrow({
      where: { listingId: listing.id, buyerId: buyers[0].id },
    });
    const cancelled = await applyTransition(deal.id, 'cancel', buyers[0]);
    check('unfunded deal cancels', cancelled.ok, cancelled.ok ? '' : cancelled.error);

    const after = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    check('supply unchanged — it never reserved any', after.quantityRemaining === 5,
      `${after.quantityRemaining} remaining`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
