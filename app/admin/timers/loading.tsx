import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, StackSkeleton } from "@/components/skeleton";

export default function LoadingTimers() {
  return (
    <AppShell>
      <PageHeader title="Timers" description="Release deadlines that have come due." />
      <PageBody>
        <Loading label="Loading due timers">
          <StackSkeleton cards={2} lines={4} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
