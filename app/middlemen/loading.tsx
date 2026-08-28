import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, Bar, MiddlemanCardSkeleton } from "@/components/skeleton";

export default function LoadingRoster() {
  return (
    <AppShell>
      <PageHeader
        title="Middlemen"
        description="The canonical roster. A middleman not listed here is not one of ours."
      />
      <PageBody>
        <Loading label="Loading the middleman roster">
          <Bar className="h-16 w-full" />
          <div className="mt-6 grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
            {Array.from({ length: 6 }, (_, i) => (
              <MiddlemanCardSkeleton key={i} />
            ))}
          </div>
        </Loading>
      </PageBody>
    </AppShell>
  );
}
