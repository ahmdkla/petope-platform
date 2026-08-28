"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "MIDDLEMAN", "MAIN_MIDDLEMAN", "ADMIN"]),
});

export async function setUserRole(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await setUserRoleAsUser(user, input);
  if (res.ok) revalidatePath("/admin/users");
  return res;
}

export async function setUserRoleAsUser(
  actor: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  // Promoting to ADMIN is an admin-only power: a main middleman must not be
  // able to grant themselves more than they have.
  if (actor.role !== "ADMIN" && actor.role !== "MAIN_MIDDLEMAN") {
    return { ok: false, error: "Only an admin or main middleman can change roles." };
  }

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid role." };
  const { userId, role } = parsed.data;

  if (role === "ADMIN" && actor.role !== "ADMIN") {
    return { ok: false, error: "Only an admin can grant the admin role." };
  }
  if (userId === actor.id) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found." };

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role } });
    await tx.transactionLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_OVERRIDE",
        metadata: { action: "role_change", userId, from: target.role, to: role },
      },
    });
  });

  return { ok: true };
}

const blacklistSchema = z.object({
  userId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(10, "A reason is required — it is published on the blacklist page.")
    .max(500),
});

export async function blacklistUser(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await blacklistUserAsUser(user, input);
  if (res.ok) {
    revalidatePath("/admin/users");
    revalidatePath("/blacklist");
  }
  return res;
}

export async function blacklistUserAsUser(
  actor: CurrentUser,
  input: unknown,
): Promise<ActionResult> {
  if (actor.role !== "ADMIN" && actor.role !== "MAIN_MIDDLEMAN") {
    return { ok: false, error: "Only an admin or main middleman can blacklist." };
  }
  const parsed = blacklistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { userId, reason } = parsed.data;

  if (userId === actor.id) return { ok: false, error: "You cannot blacklist yourself." };

  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "ADMIN") {
    return { ok: false, error: "Remove the admin role before blacklisting that account." };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "BLACKLISTED",
        blacklistReason: reason,
        blacklistedAt: new Date(),
        blacklistedById: actor.id,
      },
    });
    // Sessions are database-backed, so this bites on their next request —
    // which is why Better Auth was chosen over a JWT-only scheme.
    await tx.session.deleteMany({ where: { userId } });
    await tx.transactionLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_OVERRIDE",
        metadata: { action: "blacklist", userId, reason },
      },
    });
  });

  return { ok: true };
}

export async function restoreUser(userId: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "You must be signed in." };
  if (actor.role !== "ADMIN" && actor.role !== "MAIN_MIDDLEMAN") {
    return { ok: false, error: "Only an admin or main middleman can restore an account." };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        blacklistReason: null,
        blacklistedAt: null,
        blacklistedById: null,
      },
    });
    await tx.transactionLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_OVERRIDE",
        metadata: { action: "restore", userId },
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/blacklist");
  return { ok: true };
}
