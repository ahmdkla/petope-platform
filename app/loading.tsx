import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, Bar, CardSkeleton, ListSkeleton } from "@/components/skeleton";

/**
 * The dashboard, and the fallback for any segment below that has not defined
 * its own. Route groups do not create segments, so `(auth)` carries its own
 * `loading.tsx` — otherwise the sign-in page would flash an application shell
 * it never renders.
 */
export default function LoadingHome() {
  return (
    <AppShell>
      <PageHeader
        title="Overview"
        description="Whitelist marketplace with middleman escrow. A middleman holds funds and collateral until delivery is confirmed."
      />
      <PageBody>
        <Loading label="Loading your overview">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-line bg-card p-6 shadow-card"
              >
                <Bar className="h-4 w-28" />
                <Bar className="h-8 w-16" />
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-8">
              <div className="space-y-4">
                <Bar className="h-5 w-36" />
                <ListSkeleton rows={4} />
              </div>
              <div className="space-y-4">
                <Bar className="h-5 w-32" />
                <ListSkeleton rows={3} />
              </div>
            </div>
            <div className="min-w-0 space-y-6">
              <CardSkeleton lines={4} />
              <CardSkeleton lines={5} />
            </div>
          </div>
        </Loading>
      </PageBody>
    </AppShell>
  );
}
