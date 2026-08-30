import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, Bar, Tile, CardSkeleton } from "@/components/skeleton";

export default function LoadingLastSales() {
  return (
    <AppShell>
      <PageHeader
        title="Last sales"
        description="Every spot sold through a middleman, newest first. One entry per sale, so a listing that sells twice appears twice."
      />
      <PageBody>
        <Loading label="Loading recent sales">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
          <div className="min-w-0 space-y-5">
            <Bar className="h-16 w-full" />
            <div className="divide-y divide-line rounded-lg border border-line bg-card shadow-card">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-3 px-5 py-4">
                  <div className="flex justify-between gap-4">
                    <Bar className="h-5 w-44" />
                    <Bar className="h-4 w-20" />
                  </div>
                  <div className="flex gap-1.5">
                    <Bar className="h-6 w-16" />
                    <Bar className="h-6 w-14" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    {Array.from({ length: 3 }, (_, j) => (
                      <div key={j} className="space-y-1.5">
                        <Bar className="h-3.5 w-20" />
                        <Bar className="h-4 w-24" />
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Tile className="size-8" />
                      <Bar className="h-4 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <CardSkeleton lines={6} />
          </div>
        </Loading>
      </PageBody>
    </AppShell>
  );
}
