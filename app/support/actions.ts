"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, isMiddleman, type CurrentUser } from "@/lib/session";
import { assertSupportParticipant } from "@/lib/support-access";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type OpenResult = { ok: true; ticketId: string } | { ok: false; error: string };

const openSchema = z.object({
  category: z.enum(["GENERAL_HELP", "ACCOUNT_ISSUE", "ADS_PREMIUM", "REPORT_PROBLEM"]),
  subject: z.string().trim().min(4, "Give it a short subject.").max(160),
  body: z.string().trim().min(10, "Describe what you need.").max(4000),
});

export async function openTicket(input: unknown): Promise<OpenResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await openTicketAsUser(user, input);
  if (res.ok) revalidatePath("/support");
  return res;
}

export async function openTicketAsUser(
  user: CurrentUser,
  input: unknown,
): Promise<OpenResult> {
  if (user.status !== "ACTIVE") {
    return { ok: false, error: "Your account cannot open support rooms." };
  }
  const parsed = openSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  // Mirrors the deal-room reference: a display string built from real fields,
  // never parsed for logic.
  const count = await db.supportTicket.count();
  const reference = `SUP-${String(count + 1).padStart(3, "0")}`;

  const ticket = await db.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        reference,
        openedById: user.id,
        category: parsed.data.category,
        subject: parsed.data.subject,
      },
    });

    await tx.supportMessage.create({
      data: { ticketId: created.id, authorId: user.id, kind: "USER", body: parsed.data.body },
    });

    await tx.supportMessage.create({
      data: {
        ticketId: created.id,
        authorId: null,
        kind: "SYSTEM",
        body: "Support room opened. A middleman or admin will pick this up. This room carries no escrow — never send funds or credentials here.",
      },
    });

    return created;
  });

  return { ok: true, ticketId: ticket.id };
}

export async function postSupportMessage(
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await postSupportMessageAsUser(user, ticketId, body);
  if (res.ok) revalidatePath(`/support/${ticketId}`);
  return res;
}

export async function postSupportMessageAsUser(
  user: CurrentUser,
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, error: "Support room not found." };

  const access = assertSupportParticipant(ticket, user);
  if (!access.allowed) return { ok: false, error: "You cannot post in this room." };

  const parsed = z.string().trim().min(1).max(4000).safeParse(body);
  if (!parsed.success) return { ok: false, error: "Write a message first." };

  if (ticket.status === "CLOSED") {
    return { ok: false, error: "This room is closed." };
  }

  await db.$transaction(async (tx) => {
    await tx.supportMessage.create({
      data: { ticketId, authorId: user.id, kind: "USER", body: parsed.data },
    });

    // First staff reply claims the room, so the queue reflects who is on it.
    if (access.role === "STAFF" && !ticket.assignedToId) {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { assignedToId: user.id, status: "ASSIGNED" },
      });
      await tx.supportMessage.create({
        data: {
          ticketId,
          authorId: null,
          kind: "SYSTEM",
          body: `${user.displayName ?? "A team member"} picked up this room.`,
        },
      });
    }
  });

  return { ok: true };
}

export async function setTicketStatus(
  ticketId: string,
  status: "RESOLVED" | "CLOSED" | "OPEN",
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await setTicketStatusAsUser(user, ticketId, status);
  if (res.ok) {
    revalidatePath(`/support/${ticketId}`);
    revalidatePath("/support");
  }
  return res;
}

export async function setTicketStatusAsUser(
  user: CurrentUser,
  ticketId: string,
  status: "RESOLVED" | "CLOSED" | "OPEN",
): Promise<ActionResult> {
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, error: "Support room not found." };

  const access = assertSupportParticipant(ticket, user);
  if (!access.allowed) return { ok: false, error: "You cannot change this room." };

  // The opener may close their own room; only staff may mark it resolved.
  if (status === "RESOLVED" && !isMiddleman(user.role)) {
    return { ok: false, error: "Only the team can mark a room resolved." };
  }

  await db.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status, resolvedAt: status === "OPEN" ? null : new Date() },
    });
    await tx.supportMessage.create({
      data: {
        ticketId,
        authorId: null,
        kind: "SYSTEM",
        body: `${user.displayName ?? "Someone"} marked this room ${status.toLowerCase()}.`,
      },
    });
  });

  return { ok: true };
}
