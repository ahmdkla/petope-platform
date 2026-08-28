import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, Bar, ListingCardSkeleton } from "@/components/skeleton";

export default function LoadingListings() {
  return (
    <AppShell>
      <PageHeader
        title="Marketplace"
        description="Whitelist spots, presale allocations, and NFTs, bought and sold through a middleman."
      />
      <PageBody>
        <Loading label="Loading listings">
          <div className="mb-6 flex flex-wrap gap-3">
            <Bar className="h-field w-32" />
            <Bar className="h-field w-40" />
            <Bar className="h-field w-36" />
            <Bar className="h-field w-28" />
          </div>
          <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))]">
            {Array.from({ length: 8 }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </Loading>
      </PageBody>
    </AppShell>
  );
}
