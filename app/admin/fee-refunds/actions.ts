"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { getMmFeeConfig } from "@/lib/admin-settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  dealId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(10, "Explain what happened — a reason is required and is recorded.")
    .max(2000),
});

/** States in which a deal has closed and its closing time is known. */
const TERMINAL = ["COMPLETED", "REFUNDED", "CANCELLED"] as const;

/**
 * The ONLY path that refunds the middleman fee.
 *
 * The fee is non-refundable by default — the middleman did the work whatever
 * the outcome. It is returned solely when the deal involved a scammer and the
 * request comes within the configured window of the deal closing. Ordinary
 * refunds (the `refund` transition) deliberately leave the fee in place.
 */
export async function refundMmFee(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await refundMmFeeAsUser(user, input);
  if (res.ok) {
    revalidatePath("/admin/fee-refunds");
  }
  return res;
}

/**
 * The actual rule. Split from the session wrapper above so tests exercise these
 * guards directly rather than a copy of them — same shape as the engine
 * functions, which all take an explicit CurrentUser.
 */
export async function refundMmFeeAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  // A dispute-level judgement, not the assigned middleman's call.
  if (user.role !== "ADMIN" && user.role !== "MAIN_MIDDLEMAN") {
    return {
      ok: false,
      error: "Only an admin or main middleman can refund the middleman fee.",
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { dealId, reason } = parsed.data;

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.mmFee <= 0n) return { ok: false, error: "No middleman fee was charged on this deal." };

  if (!TERMINAL.includes(deal.status as (typeof TERMINAL)[number])) {
    return {
      ok: false,
      error: "The fee can only be refunded after the deal has closed.",
    };
  }

  const closedAt = deal.completedAt ?? deal.cancelledAt ?? deal.updatedAt;
  const { refundWindowHours } = await getMmFeeConfig();
  const elapsedHours = (Date.now() - closedAt.getTime()) / 3_600_000;
  if (elapsedHours > refundWindowHours) {
    return {
      ok: false,
      error: `The ${refundWindowHours}-hour window closed ${Math.floor(elapsedHours - refundWindowHours)} hours ago. The fee can no longer be refunded.`,
    };
  }

  // The ledger is the record — no separate column to fall out of step with it.
  const already = await db.transactionLog.findFirst({
    where: { dealId, action: "MM_FEE_REFUNDED" },
    select: { id: true },
  });
  if (already) {
    return { ok: false, error: "The fee on this deal has already been refunded." };
  }

  await db.$transaction(async (tx) => {
    await tx.transactionLog.create({
      data: {
        dealId,
        actorId: user.id,
        action: "MM_FEE_REFUNDED",
        amount: deal.mmFee,
        asset: deal.asset,
        fromStatus: deal.status,
        toStatus: deal.status,
        metadata: {
          reason,
          grounds: "scammer",
          closedAt: closedAt.toISOString(),
          windowHours: refundWindowHours,
        },
      },
    });

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null,
        kind: "SYSTEM",
        body: `The middleman fee was refunded by an administrator. Reason: ${reason}`,
      },
    });
  });

  return { ok: true };
}
