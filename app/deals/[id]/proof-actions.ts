"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ProofKind } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { assertDealParticipant } from "@/lib/deal-access";
import { applyTransition } from "@/lib/deal-engine";
import { PROOF_SUBMITTER, PROOF_KIND_LABEL } from "@/lib/deal-methods";
// Escrow code depends on the INTERFACE instance only, never on ManualVerifier.
import { paymentVerifier, SelfVerificationError } from "@/lib/payments";

export type ActionResult = { ok: true } | { ok: false; error: string };

const isDemo = process.env.DEMO_MODE === "true";

/**
 * A Solscan URL or a raw transaction signature.
 *
 * Validated for SHAPE only. The server never resolves it — it is displayed as
 * a link the middleman opens themselves. DEMO_MODE relaxes the check so test
 * data can be entered freely; it never relaxes the confirmation step.
 */
const referenceSchema = isDemo
  ? z.string().trim().min(1).max(500)
  : z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(
        (v) =>
          /^https:\/\/(solscan\.io|explorer\.solana\.com)\//i.test(v) ||
          /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(v),
        "Paste a Solscan link or a raw transaction signature.",
      );

const submitSchema = z.object({
  kind: z.enum(["BUYER_PAYMENT", "SELLER_COLLATERAL"]),
  reference: referenceSchema,
  claimedAmount: z.bigint().positive().nullable(),
  screenshotUrl: z.string().trim().url().nullable(),
});

export async function submitProof(
  dealId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: "Deal not found." };

  const access = await assertDealParticipant(deal, user, { audit: false });
  if (!access.allowed) return { ok: false, error: "You are not a party to this deal." };

  if (deal.status !== "AWAITING_PAYMENT") {
    return { ok: false, error: "Proofs can only be submitted while the deal is awaiting payment." };
  }

  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid proof." };
  }
  const data = parsed.data;

  // The buyer submits the buyer payment, the seller submits collateral.
  const expected = PROOF_SUBMITTER[data.kind as ProofKind];
  if (access.role !== expected && access.role !== "ADMIN") {
    return {
      ok: false,
      error: `Only the ${expected.toLowerCase()} submits the ${PROOF_KIND_LABEL[data.kind as ProofKind].toLowerCase()} proof.`,
    };
  }

  const alreadySettled = await db.paymentProof.findFirst({
    where: { dealId, kind: data.kind, status: { in: ["SUBMITTED", "CONFIRMED"] } },
    select: { status: true },
  });
  if (alreadySettled) {
    return {
      ok: false,
      error:
        alreadySettled.status === "CONFIRMED"
          ? "This payment has already been confirmed."
          : "A proof is already awaiting review. Wait for the middleman to decide on it.",
    };
  }

  await paymentVerifier.submitProof({
    dealId,
    submittedById: user.id,
    kind: data.kind,
    reference: data.reference,
    claimedAmount: data.claimedAmount,
    // The deal settles in exactly one asset; the claim inherits it.
    claimedAsset: deal.asset,
    screenshotUrl: data.screenshotUrl,
  });

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

const verifySchema = z.object({
  proofId: z.string().min(1),
  decision: z.enum(["confirm", "reject"]),
  note: z.string().trim().max(2000).nullable(),
});

/**
 * The manual verification step — the thing the whole product hinges on.
 *
 * Only the assigned middleman (or an admin) may decide, never the submitter.
 */
export async function verifyProof(
  dealId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: "Deal not found." };

  const access = await assertDealParticipant(deal, user, { audit: false });
  if (!access.allowed) return { ok: false, error: "You are not a party to this deal." };
  if (access.role !== "MIDDLEMAN" && access.role !== "ADMIN") {
    return { ok: false, error: "Only the assigned middleman verifies payments." };
  }

  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid decision." };
  }
  const data = parsed.data;

  if (data.decision === "reject" && !data.note) {
    return { ok: false, error: "Add a note explaining why the proof was rejected." };
  }

  const proof = await db.paymentProof.findUnique({
    where: { id: data.proofId },
    select: { dealId: true },
  });
  if (!proof || proof.dealId !== dealId) {
    return { ok: false, error: "That proof does not belong to this deal." };
  }

  let result;
  try {
    result = await paymentVerifier.verify({
      proofId: data.proofId,
      verifierId: user.id,
      decision: data.decision,
      note: data.note,
    });
  } catch (e) {
    if (e instanceof SelfVerificationError) {
      return { ok: false, error: "You cannot verify a proof you submitted yourself." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Verification failed." };
  }

  /**
   * Funding follows from two explicit human confirmations, not from a
   * submission. It still goes through the engine, so it writes its own ledger
   * row and is subject to the same guard.
   */
  if (result.dealFunded) {
    await applyTransition(dealId, "mark_funded", user, {
      metadata: { triggeredBy: "final proof confirmation", proofId: data.proofId },
    });
  }

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/queue");
  return { ok: true };
}
