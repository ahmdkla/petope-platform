/**
 * Persistent notice required by CLAUDE.md whenever DEMO_MODE is on: this build
 * processes no real payments. Server component — reads the env directly.
 */
export function DemoBanner() {
  if (process.env.DEMO_MODE !== "true") return null;

  return (
    <div className="border-b border-line bg-warn-soft px-4 py-2 text-xs text-warn">
      Demo build. No real payments are processed and no real funds move. All
      accounts and deals shown are test data.
    </div>
  );
}
