"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { runDueTimers, type TimerOutcome } from "@/lib/deal-timers";

export type TimerRunResult =
  | { ok: true; outcomes: TimerOutcome[] }
  | { ok: false; error: string };

/**
 * Manual stand-in for the scheduled job (build-order step 6). The job will call
 * runDueTimers directly; this exists so the behaviour is demonstrable now.
 */
export async function runTimersNow(): Promise<TimerRunResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (user.role !== "ADMIN" && user.role !== "MAIN_MIDDLEMAN") {
    return { ok: false, error: "Only an admin or main middleman can run the timers." };
  }

  const outcomes = await runDueTimers(user.id);

  revalidatePath("/admin/timers");
  revalidatePath("/deals");
  revalidatePath("/queue");
  return { ok: true, outcomes };
}
