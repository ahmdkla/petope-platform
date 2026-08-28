import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, StackSkeleton } from "@/components/skeleton";

export default function LoadingReports() {
  return (
    <AppShell>
      <PageHeader title="Reports" description="Scammer reports awaiting review." />
      <PageBody>
        <Loading label="Loading reports">
          <StackSkeleton cards={3} lines={4} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
