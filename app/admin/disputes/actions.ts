"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  dealId: z.string().min(1),
  outcome: z.enum(["release_to_seller", "refund_buyer", "split", "other"]),
  reasoning: z
    .string()
    .trim()
    .min(20, "Record the reasoning — this is the permanent account of the ruling.")
    .max(4000),
});

/**
 * Records a dispute ruling.
 *
 * This does NOT move money or change the deal's status. It writes the decision
 * to the ledger and posts it into the room; the middleman then performs the
 * actual release or refund through the normal transition, which has its own
 * proof requirements. Keeping the ruling and the payout separate is deliberate:
 * a ruling is a judgement, a payout is an irreversible action.
 */
export async function recordRuling(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await recordRulingAsUser(user, input);
  if (res.ok) revalidatePath("/admin/disputes");
  return res;
}

export async function recordRulingAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  if (user.role !== "ADMIN" && user.role !== "MAIN_MIDDLEMAN") {
    return { ok: false, error: "Only an admin or main middleman can rule on a dispute." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ruling." };
  }
  const { dealId, outcome, reasoning } = parsed.data;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { id: true, status: true, reference: true },
  });
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.status !== "DISPUTED") {
    return { ok: false, error: "That deal is not under dispute." };
  }

  const OUTCOME_TEXT: Record<string, string> = {
    release_to_seller: "release the funds to the seller",
    refund_buyer: "refund the buyer",
    split: "split the funds between the parties",
    other: "resolve as described",
  };

  await db.$transaction(async (tx) => {
    await tx.transactionLog.create({
      data: {
        dealId,
        actorId: user.id,
        action: "DISPUTE_RULED",
        fromStatus: "DISPUTED",
        toStatus: "DISPUTED",
        metadata: { outcome, reasoning, ruledBy: user.role },
      },
    });

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null,
        kind: "SYSTEM",
        body: `Dispute ruling: ${OUTCOME_TEXT[outcome]}. Reasoning: ${reasoning}\n\nThe assigned middleman now carries this out through the normal steps, recording the outgoing payment as usual.`,
      },
    });
  });

  return { ok: true };
}
