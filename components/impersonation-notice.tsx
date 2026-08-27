import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Impersonation is the top threat (CLAUDE.md). This is the standing warning the
 * Discord carries, surfaced wherever a user might first meet a "middleman".
 */
export function ImpersonationNotice() {
  return (
    <p className="flex gap-2.5 rounded-lg border border-line bg-card p-4 text-meta text-ink-muted shadow-card">
      <ShieldAlert aria-hidden className="size-[18px] shrink-0 text-warn" strokeWidth={1.75} />
      <span>
      Middlemen never DM you first. Anyone who does is an impersonator. Check
      every middleman against the{" "}
      <Link
        href="/middlemen"
        className="font-medium text-accent-text underline underline-offset-2"
      >
        official roster
      </Link>{" "}
      before sending anything.
      </span>
    </p>
  );
}
