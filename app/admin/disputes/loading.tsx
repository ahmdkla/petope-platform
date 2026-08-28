import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, StackSkeleton } from "@/components/skeleton";

export default function LoadingDisputes() {
  return (
    <AppShell>
      <PageHeader title="Disputes" description="Escalated deals, both parties' claims, and the full ticket history." />
      <PageBody>
        <Loading label="Loading the dispute queue">
          <StackSkeleton cards={3} lines={5} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
