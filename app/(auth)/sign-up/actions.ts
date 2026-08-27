"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Records explicit consent, server-side, against the signed-in session.
 *
 * CLAUDE.md: the Discord treats opening a ticket as implicit agreement; the web
 * platform requires an explicit checkbox and a recorded timestamp. The client
 * never supplies the user id — it is read from the session.
 */
export async function acceptTerms() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;

  await db.user.update({
    where: { id: session.user.id },
    data: { termsAcceptedAt: new Date() },
  });
}
