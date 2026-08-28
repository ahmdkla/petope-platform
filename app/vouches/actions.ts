"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  dealId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(10, "Write a sentence or two — a vouch is for other people to read.")
    .max(1000),
});

export async function leaveVouch(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await leaveVouchAsUser(user, input);
  if (res.ok) {
    revalidatePath("/vouches");
    revalidatePath("/middlemen");
  }
  return res;
}

/**
 * A vouch is tied to a COMPLETED deal the author was a party to.
 *
 * That is the anti-fake-vouch protection, and it is an improvement over the
 * Discord where anyone can post one. Because the deal comes from the room the
 * author is standing in rather than a list they pick from, the rule cannot be
 * gamed by choosing someone else's deal — but it is still re-checked here,
 * because a client-supplied dealId proves nothing.
 */
export async function leaveVouchAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid vouch." };
  }
  const { dealId, body } = parsed.data;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      status: true,
      buyerId: true,
      sellerId: true,
      middlemanId: true,
    },
  });
  if (!deal) return { ok: false, error: "Deal not found." };

  if (deal.status !== "COMPLETED") {
    return { ok: false, error: "You can only vouch for a deal that completed." };
  }
  // The middleman cannot vouch for themselves, and a bystander cannot vouch at all.
  if (deal.buyerId !== user.id && deal.sellerId !== user.id) {
    return { ok: false, error: "Only the buyer or seller on that deal can vouch." };
  }
  if (!deal.middlemanId) {
    return { ok: false, error: "That deal had no assigned middleman to vouch for." };
  }

  const existing = await db.vouch.findFirst({
    where: { dealId, authorId: user.id },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "You have already vouched on this deal." };
  }

  await db.vouch.create({
    data: {
      dealId,
      authorId: user.id,
      middlemanId: deal.middlemanId,
      body,
      // rating stays null: docs/DECISIONS.md records that a numeric score is a
      // product decision not yet confirmed, and no average is ever surfaced.
    },
  });

  return { ok: true };
}
