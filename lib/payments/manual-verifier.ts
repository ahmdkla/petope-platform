import type { PaymentProof } from '@prisma/client';
import { db } from '../db';
import {
  assertNotSelfVerification,
  type PaymentVerifier,
  type SubmitProofArgs,
  type VerifyArgs,
  type VerifyResult,
} from './verifier';
import { requiredProofKinds } from '../deal-methods';

/**
 * v1 — the only implementation that exists.
 *
 * It records what a human middleman decided. It never fetches the reference,
 * never calls an RPC, never reads a chain. `reference` is opaque text that a
 * person opens in their own browser.
 *
 * A future automated verifier implements the same interface and swaps in here;
 * no escrow code changes, because escrow code depends on PaymentVerifier only.
 */
export class ManualVerifier implements PaymentVerifier {
  /**
   * Records a CLAIM. Nothing about the deal changes: a SUBMITTED proof is
   * unverified data until a middleman opens the link and decides.
   */
  async submitProof(args: SubmitProofArgs): Promise<PaymentProof> {
    const proof = await db.$transaction(async (tx) => {
      const created = await tx.paymentProof.create({
        data: {
          dealId: args.dealId,
          kind: args.kind,
          submittedById: args.submittedById,
          reference: args.reference,
          claimedAmount: args.claimedAmount ?? null,
          claimedAsset: args.claimedAsset ?? null,
          screenshotUrl: args.screenshotUrl ?? null,
          // Explicit rather than relying on the default: this is the whole
          // point of the model.
          status: 'SUBMITTED',
        },
      });

      await tx.transactionLog.create({
        data: {
          dealId: args.dealId,
          actorId: args.submittedById,
          action: 'PROOF_SUBMITTED',
          proofId: created.id,
          amount: args.claimedAmount ?? null,
          asset: args.claimedAsset ?? null,
          reference: args.reference,
          metadata: { kind: args.kind, note: 'claim only, not verified' },
        },
      });

      await tx.dealMessage.create({
        data: {
          dealId: args.dealId,
          authorId: null,
          kind: 'SYSTEM',
          body: `A payment proof was submitted for review. It changes nothing until the middleman opens the link and confirms it.`,
        },
      });

      return created;
    });

    return proof;
  }

  /**
   * The human decision. This is what advances state — and the only thing that
   * does. Records who decided and when.
   */
  async verify(args: VerifyArgs): Promise<VerifyResult> {
    const proof = await db.paymentProof.findUnique({
      where: { id: args.proofId },
      include: { deal: { select: { id: true, middlemanId: true, method: true } } },
    });
    if (!proof) throw new Error('Payment proof not found.');

    if (proof.status !== 'SUBMITTED') {
      throw new Error(
        'This proof has already been decided. A rejected proof is superseded by a new submission, never edited.',
      );
    }

    // Throws SelfVerificationError. The database CHECK is the backstop.
    assertNotSelfVerification(proof, args.verifierId);

    const confirming = args.decision === 'confirm';

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.paymentProof.update({
        where: { id: args.proofId },
        data: {
          status: confirming ? 'CONFIRMED' : 'REJECTED',
          verifiedById: args.verifierId,
          verifiedAt: new Date(),
          verifierNote: args.note ?? null,
        },
      });

      // Names the verifier, always. No anonymous confirmations.
      await tx.transactionLog.create({
        data: {
          dealId: proof.dealId,
          actorId: args.verifierId,
          action: confirming ? 'PROOF_CONFIRMED' : 'PROOF_REJECTED',
          proofId: proof.id,
          amount: proof.claimedAmount,
          asset: proof.claimedAsset,
          reference: proof.reference,
          metadata: {
            kind: proof.kind,
            submittedById: proof.submittedById,
            note: args.note ?? null,
          },
        },
      });

      await tx.dealMessage.create({
        data: {
          dealId: proof.dealId,
          authorId: null,
          kind: 'SYSTEM',
          body: confirming
            ? 'The middleman opened the reference, checked it personally, and confirmed the payment.'
            : `The middleman rejected a payment proof.${args.note ? ` Reason: ${args.note}` : ''} A new proof can be submitted.`,
        },
      });

      return next;
    });

    return { proof: updated, dealFunded: await this.isFullyFunded(proof.dealId) };
  }

  /** True when every proof the method requires is CONFIRMED. */
  private async isFullyFunded(dealId: string): Promise<boolean> {
    const deal = await db.deal.findUnique({
      where: { id: dealId },
      select: { method: true },
    });
    if (!deal?.method) return false;

    const confirmed = await db.paymentProof.findMany({
      where: { dealId, status: 'CONFIRMED' },
      select: { kind: true },
      distinct: ['kind'],
    });
    const have = confirmed.map((c) => c.kind);
    return requiredProofKinds(deal.method).every((k) => have.includes(k));
  }
}
