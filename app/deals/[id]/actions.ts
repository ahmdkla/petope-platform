"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { assertDealParticipant } from "@/lib/deal-access";
import { applyTransition, confirmMethod } from "@/lib/deal-engine";
import { DEAL_METHOD_RULES } from "@/lib/deal-methods";
import type { TransitionId } from "@/lib/deal-transitions";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Every state change goes through the engine. Nothing writes status directly. */
export async function runTransition(
  dealId: string,
  transitionId: TransitionId,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const res = await applyTransition(dealId, transitionId, user);
  if (!res.ok) return res;

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  revalidatePath("/queue");
  return { ok: true };
}

export async function setMethodConfirmation(
  dealId: string,
  confirmed: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const res = await confirmMethod(dealId, user, confirmed);
  if (!res.ok) return res;

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

const termsSchema = z.object({
  method: z.enum([
    "DISCORD_SURRENDER",
    "WALLET_SURRENDER",
    "WALLET_SUBMIT",
    "MINT_FOR_YOU",
    "PRESALE",
    "CODE",
    "OTC",
  ]),
  mmFee: z.bigint().positive("The MM fee must be greater than zero"),
  collateralAmount: z.bigint().nonnegative().nullable(),
  mintPrice: z.bigint().nonnegative().nullable(),
  mintAt: z.date().nullable(),
});

/**
 * The middleman proposes the terms, including which escrow method applies.
 *
 * Proposing a method RESETS both confirmations: a party who agreed to one
 * method has not agreed to a different one. This is why the method is never
 * auto-derived from listing.type — the listing only supplies a suggestion.
 */
export async function proposeTerms(
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
    return { ok: false, error: "Only the assigned middleman sets the terms." };
  }
  if (deal.status !== "CLAIMED") {
    return { ok: false, error: "Terms can only be set before they are locked." };
  }

  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid terms." };
  }
  const data = parsed.data;

  const rule = DEAL_METHOD_RULES[data.method];
  if (!rule.implemented) {
    return {
      ok: false,
      error: `${rule.label} is not available yet: its flow is still undocumented.`,
    };
  }

  const methodChanged = deal.method !== data.method;

  await db.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: dealId },
      data: {
        method: data.method,
        mmFee: data.mmFee,
        collateralAmount: data.collateralAmount,
        mintPrice: data.mintPrice,
        mintAt: data.mintAt,
        ...(methodChanged
          ? { methodConfirmedByBuyerAt: null, methodConfirmedBySellerAt: null }
          : {}),
      },
    });

    await tx.dealMessage.create({
      data: {
        dealId,
        authorId: null,
        kind: "SYSTEM",
        body: methodChanged
          ? `The middleman proposed ${rule.label}. Both parties must confirm before terms can be locked.`
          : "The middleman updated the deal terms.",
      },
    });
  });

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

const messageSchema = z.string().trim().min(1).max(4000);

/** Chat is append-only: the transcript is a permanent record (CLAUDE.md). */
export async function postMessage(
  dealId: string,
  body: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: "Deal not found." };

  const access = await assertDealParticipant(deal, user, { audit: false });
  if (!access.allowed) return { ok: false, error: "You are not a party to this deal." };

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Write a message first." };

  await db.dealMessage.create({
    data: { dealId, authorId: user.id, kind: "USER", body: parsed.data },
  });

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}
