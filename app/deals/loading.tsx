import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, DealListSkeleton } from "@/components/skeleton";

export default function LoadingDeals() {
  return (
    <AppShell>
      <PageHeader
        title="My deals"
        description="Every deal you are a party to, as buyer, seller, or assigned middleman."
      />
      <PageBody>
        <Loading label="Loading your deals">
          <DealListSkeleton />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
