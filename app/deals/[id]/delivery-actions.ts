"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { declareHandover, confirmReceipt } from "@/lib/deal-engine";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function declareHandoverAction(
  dealId: string,
  declared: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const res = await declareHandover(dealId, user, declared);
  if (!res.ok) return res;

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

export async function confirmReceiptAction(dealId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const res = await confirmReceipt(dealId, user);
  if (!res.ok) return res;

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}
