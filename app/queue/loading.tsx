import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, StackSkeleton } from "@/components/skeleton";

export default function LoadingQueue() {
  return (
    <AppShell>
      <PageHeader title="Middleman queue" description="Unclaimed deals and the ones you are holding." />
      <PageBody>
        <Loading label="Loading the queue">
          <StackSkeleton cards={4} lines={3} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
