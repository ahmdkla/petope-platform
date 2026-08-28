import { AppShell, PageHeader } from "@/components/shell/app-shell";
import { Loading, Bar, Tile, CardSkeleton } from "@/components/skeleton";

export default function LoadingSupportRoom() {
  return (
    <AppShell>
      <PageHeader title="Support" description="Support room" />
      <Loading label="Loading the support room">
        <div className="grid gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4 rounded-lg border border-line bg-card p-6 shadow-card">
            <Bar className="h-5 w-28" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Tile className="size-8" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bar className="h-4 w-28" />
                  <Bar className={`h-4 ${i % 2 ? "w-2/3" : "w-full"}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <CardSkeleton lines={4} />
          </div>
        </div>
      </Loading>
    </AppShell>
  );
}
