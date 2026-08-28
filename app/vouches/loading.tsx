import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, Bar, Tile, CardSkeleton } from "@/components/skeleton";

export default function LoadingVouches() {
  return (
    <AppShell>
      <PageHeader
        title="Vouches"
        description="Every vouch is tied to a completed deal the author was party to."
      />
      <PageBody>
        <Loading label="Loading vouches">
          <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-lg border border-line bg-card p-6 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <Tile className="size-10" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Bar className="h-4 w-32" />
                      <Bar className="h-4 w-48" />
                    </div>
                    <Bar className="h-4 w-20" />
                  </div>
                  <Bar className="h-4 w-full" />
                  <Bar className="h-4 w-3/4" />
                </div>
              ))}
            </div>
            <CardSkeleton lines={6} />
          </div>
        </Loading>
      </PageBody>
    </AppShell>
  );
}
