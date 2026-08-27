import Link from "next/link";

/**
 * Impersonation is the top threat (CLAUDE.md). This is the standing warning the
 * Discord carries, surfaced wherever a user might first meet a "middleman".
 */
export function ImpersonationNotice() {
  return (
    <p className="rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink-muted">
      Middlemen never DM you first. Anyone who does is an impersonator. Check
      every middleman against the{" "}
      <Link
        href="/middlemen"
        className="text-accent underline underline-offset-2"
      >
        official roster
      </Link>{" "}
      before sending anything.
    </p>
  );
}
