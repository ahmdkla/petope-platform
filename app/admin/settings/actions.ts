"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  feePercent: z.number().min(0).max(50),
  feeFloorStable: z.number().min(0),
  feeFloorSol: z.number().min(0),
  refundWindowHours: z.number().int().min(1).max(720),
  collateralMinimum: z.number().min(0),
  maxConcurrentDeals: z.number().int().min(1).max(100),
});

/**
 * Writes the AdminSetting rows the engine reads.
 *
 * Amounts arrive as display numbers and are stored in smallest units — a fee
 * floor written as `5` rather than `5_000_000` would silently become
 * $0.000005. The conversion happens here, once.
 */
export async function updateSettings(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await updateSettingsAsUser(user, input);
  if (res.ok) revalidatePath("/admin/settings");
  return res;
}

export async function updateSettingsAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  if (user.role !== "ADMIN" && user.role !== "MAIN_MIDDLEMAN") {
    return { ok: false, error: "Only an admin or main middleman can change settings." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }
  const v = parsed.data;

  const usd = (n: number) => Math.round(n * 1_000_000);
  const sol = (n: number) => Math.round(n * 1_000_000_000);

  const rows: { key: string; value: object; description: string }[] = [
    {
      key: "mmFee.config",
      value: {
        percentBasisPoints: Math.round(v.feePercent * 100),
        floor: { STABLE: usd(v.feeFloorStable), SOL: sol(v.feeFloorSol) },
        refundWindowHours: v.refundWindowHours,
        note: "fee = max(floor, (dealAmount + collateral) * percent). Floors are per-asset smallest units; there is no price feed, so the SOL floor is set by hand.",
      },
      description: "MM fee structure and the scammer refund window.",
    },
    {
      key: "collateral.minimum",
      value: { amount: usd(v.collateralMinimum), asset: "STABLE" },
      description: "Minimum seller collateral, all methods.",
    },
    {
      key: "listing.maxConcurrentDeals",
      value: { max: v.maxConcurrentDeals },
      description: "How many active deals one listing may carry at once.",
    },
  ];

  await db.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.adminSetting.upsert({
        where: { key: row.key },
        create: { ...row, updatedById: user.id },
        update: { value: row.value, updatedById: user.id },
      });
    }

    await tx.transactionLog.create({
      data: {
        actorId: user.id,
        action: "ADMIN_OVERRIDE",
        metadata: { action: "settings_updated", keys: rows.map((r) => r.key) },
      },
    });
  });

  return { ok: true };
}
