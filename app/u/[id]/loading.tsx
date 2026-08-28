import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, CardSkeleton, ListSkeleton, Bar } from "@/components/skeleton";

export default function LoadingProfile() {
  return (
    <AppShell>
      <PageHeader title="Member" description="Public member profile." />
      <PageBody>
        <Loading label="Loading this member">
          <div className="grid max-w-4xl gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <CardSkeleton lines={4} />
            <div className="min-w-0 space-y-4">
              <Bar className="h-5 w-36" />
              <ListSkeleton rows={4} />
            </div>
          </div>
        </Loading>
      </PageBody>
    </AppShell>
  );
}
