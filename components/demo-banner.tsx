import { TriangleAlert } from "lucide-react";

/**
 * Persistent notice required by CLAUDE.md whenever DEMO_MODE is on: this build
 * processes no real payments. Server component — reads the env directly.
 */
export function DemoBanner() {
  if (process.env.DEMO_MODE !== "true") return null;

  return (
    <div className="flex items-center gap-2 border-b border-warn/25 bg-warn-soft px-8 py-2.5 text-meta text-warn">
      <TriangleAlert aria-hidden className="size-4 shrink-0" strokeWidth={2} />
      Demo build. No real payments are processed and no real funds move. All
      accounts and deals shown are test data.
    </div>
  );
}
