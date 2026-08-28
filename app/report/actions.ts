"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { TAGS } from "@/lib/public-data";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  accusedHandle: z.string().trim().min(2, "Who are you reporting?").max(120),
  category: z.enum(["SCAM", "DM_IMPERSONATION", "ALT_ACCOUNT", "OTHER"]),
  evidence: z
    .string()
    .trim()
    .min(20, "Describe what happened — a reviewer has to be able to act on this.")
    .max(4000),
  /** A link a reviewer opens themselves. The server never fetches it. */
  evidenceUrl: z.string().trim().url("Evidence link must be a URL.").nullable(),
  dealReference: z.string().trim().max(60).nullable(),
});

export async function fileReport(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to file a report." };
  return fileReportAsUser(user, input);
}

/** The rule, callable with an explicit actor so tests hit the real guards. */
export async function fileReportAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  if (user.status !== "ACTIVE") {
    return { ok: false, error: "Your account cannot file reports." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid report." };
  }
  const data = parsed.data;

  // Match the handle to an account when one exists. A DM impersonator usually
  // has none, which is why accusedUserId is nullable.
  const accused = await db.user.findFirst({
    where: {
      OR: [
        { displayName: { equals: data.accusedHandle, mode: "insensitive" } },
        { discordUsername: { equals: data.accusedHandle, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (accused?.id === user.id) {
    return { ok: false, error: "You cannot report yourself." };
  }

  const deal = data.dealReference
    ? await db.deal.findFirst({
        where: { reference: data.dealReference },
        select: { id: true },
      })
    : null;

  if (data.dealReference && !deal) {
    return { ok: false, error: "No deal found with that reference." };
  }

  // One open report per reporter per handle: repeat filings are noise in the
  // queue, not extra evidence.
  const existing = await db.scammerReport.findFirst({
    where: {
      reporterId: user.id,
      accusedHandle: { equals: data.accusedHandle, mode: "insensitive" },
      status: "PENDING",
    },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "You already have a pending report against that handle.",
    };
  }

  await db.scammerReport.create({
    data: {
      reporterId: user.id,
      accusedUserId: accused?.id ?? null,
      accusedHandle: data.accusedHandle,
      category: data.category,
      evidence: data.evidence,
      evidenceUrl: data.evidenceUrl,
      dealId: deal?.id ?? null,
    },
  });

  return { ok: true };
}

const reviewSchema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(["uphold", "dismiss"]),
  note: z.string().trim().max(2000).nullable(),
  /** Uphold only: also blacklist the matched account. */
  blacklist: z.boolean(),
});

export async function reviewReport(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await reviewReportAsUser(user, input);
  if (res.ok) {
    revalidatePath("/admin/reports");
    revalidatePath("/blacklist");
    revalidateTag(TAGS.blacklist, "max");
  }
  return res;
}

export async function reviewReportAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  if (user.role !== "ADMIN" && user.role !== "MAIN_MIDDLEMAN") {
    return { ok: false, error: "Only an admin or main middleman can review reports." };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid decision." };
  }
  const data = parsed.data;

  const report = await db.scammerReport.findUnique({ where: { id: data.reportId } });
  if (!report) return { ok: false, error: "Report not found." };
  if (report.status !== "PENDING") {
    return { ok: false, error: "This report has already been reviewed." };
  }
  if (data.decision === "dismiss" && !data.note) {
    return { ok: false, error: "Add a note explaining why the report was dismissed." };
  }
  if (data.blacklist && !report.accusedUserId) {
    return {
      ok: false,
      error: "There is no account behind that handle to blacklist. Uphold it without blacklisting.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.scammerReport.update({
      where: { id: report.id },
      data: {
        status: data.decision === "uphold" ? "UPHELD" : "DISMISSED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: data.note,
      },
    });

    if (data.blacklist && report.accusedUserId) {
      await tx.user.update({
        where: { id: report.accusedUserId },
        data: {
          status: "BLACKLISTED",
          blacklistReason: data.note ?? `Upheld report: ${report.category.toLowerCase().replace(/_/g, " ")}`,
          blacklistedAt: new Date(),
          blacklistedById: user.id,
        },
      });

      // Blacklisting is an admin action against a person; the audit trail names
      // who did it and why. Sessions are database-backed, so it bites at once.
      await tx.transactionLog.create({
        data: {
          actorId: user.id,
          action: "ADMIN_OVERRIDE",
          metadata: {
            action: "blacklist",
            reportId: report.id,
            accusedUserId: report.accusedUserId,
            accusedHandle: report.accusedHandle,
            category: report.category,
            reason: data.note ?? null,
          },
        },
      });
    }
  });

  return { ok: true };
}
