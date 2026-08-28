"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { TAGS } from "@/lib/public-data";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, isMiddleman, type CurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  projectName: z.string().trim().min(1, "Project name is required").max(120),
  chain: z.string().trim().min(1, "Chain is required").max(60),
  mintAt: z.date(),
  note: z.string().trim().max(500).nullable(),
  projectLink: z.string().trim().url("Project link must be a URL.").nullable(),
});

export async function createMintEvent(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await createMintEventAsUser(user, input);
  if (res.ok) {
    revalidatePath("/mints");
    revalidateTag(TAGS.mints, "max");
  }
  return res;
}

export async function createMintEventAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  if (!isMiddleman(user.role)) {
    return { ok: false, error: "Only middlemen and admins can edit the mint schedule." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  }

  await db.mintEvent.create({ data: { ...parsed.data, createdById: user.id } });
  return { ok: true };
}

export type RescheduleResult =
  | { ok: true; updated: number; skipped: number }
  | { ok: false; error: string };

/**
 * Move a project's mint date, and carry it to linked deals.
 *
 * A project delaying is ordinary — the Discord has a case of a three-month
 * slip. The date is corrected once here rather than on every affected deal.
 *
 * BUT: deals whose release timers have already started keep their dates. Those
 * deadlines were resolved to absolute values when the timer started precisely
 * so that a later config or schedule change could not move them retroactively
 * (docs/DECISIONS.md). Extending a seller's delivery window after the fact,
 * because someone edited a calendar entry, would be exactly that.
 */
export async function rescheduleMintEvent(
  eventId: string,
  mintAt: Date,
  note: string | null,
): Promise<RescheduleResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await rescheduleMintEventAsUser(user, eventId, mintAt, note);
  if (res.ok) {
    revalidatePath("/mints");
    revalidatePath("/deals");
    revalidateTag(TAGS.mints, "max");
  }
  return res;
}

export async function rescheduleMintEventAsUser(
  user: CurrentUser,
  eventId: string,
  mintAt: Date,
  note: string | null,
): Promise<RescheduleResult> {
  if (!isMiddleman(user.role)) {
    return { ok: false, error: "Only middlemen and admins can edit the mint schedule." };
  }

  const event = await db.mintEvent.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, error: "Mint entry not found." };

  const previous = event.mintAt;

  const linked = await db.deal.findMany({
    where: { mintEventId: eventId },
    select: {
      id: true,
      status: true,
      sellerDeliveryDeadline: true,
      buyerConfirmDeadline: true,
      autoReleaseAt: true,
    },
  });

  // A deal is safe to move while no timer has been resolved against the old
  // date. Both conditions are checked: status is the intent, the deadline
  // columns are the fact.
  const movable = linked.filter(
    (d) =>
      !["AWAITING_CONFIRMATION", "COMPLETED", "REFUNDED", "CANCELLED", "DISPUTED"].includes(
        d.status,
      ) &&
      d.sellerDeliveryDeadline === null &&
      d.buyerConfirmDeadline === null &&
      d.autoReleaseAt === null,
  );
  const frozen = linked.filter((d) => !movable.some((m) => m.id === d.id));

  const stamp = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16) + " UTC";

  await db.$transaction(async (tx) => {
    await tx.mintEvent.update({
      where: { id: eventId },
      data: { mintAt, ...(note !== null ? { note } : {}) },
    });

    if (movable.length > 0) {
      await tx.deal.updateMany({
        where: { id: { in: movable.map((d) => d.id) } },
        data: { mintAt },
      });
    }

    for (const d of movable) {
      await tx.dealMessage.create({
        data: {
          dealId: d.id,
          authorId: null,
          kind: "SYSTEM",
          body: `${event.projectName} moved its mint from ${stamp(previous)} to ${stamp(mintAt)}. This deal's mint date has been updated.${note ? ` Note: ${note}` : ""}`,
        },
      });
    }

    for (const d of frozen) {
      await tx.dealMessage.create({
        data: {
          dealId: d.id,
          authorId: null,
          kind: "SYSTEM",
          body: `${event.projectName} moved its mint to ${stamp(mintAt)}, but this deal's release timers have already started so its deadlines are unchanged. A running deadline is never moved retroactively. Raise a dispute if that is wrong for this deal.`,
        },
      });
    }

    await tx.transactionLog.create({
      data: {
        actorId: user.id,
        action: "ADMIN_OVERRIDE",
        metadata: {
          action: "mint_rescheduled",
          mintEventId: eventId,
          projectName: event.projectName,
          from: previous.toISOString(),
          to: mintAt.toISOString(),
          dealsUpdated: movable.length,
          dealsFrozen: frozen.length,
          note,
        },
      },
    });
  });

  return { ok: true, updated: movable.length, skipped: frozen.length };
}
