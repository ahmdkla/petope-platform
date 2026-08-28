import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, StackSkeleton } from "@/components/skeleton";

export default function LoadingSupport() {
  return (
    <AppShell>
      <PageHeader title="Support" description="Questions that are not about a specific deal. A middleman or admin picks these up." />
      <PageBody>
        <Loading label="Loading support rooms">
          <StackSkeleton cards={3} lines={3} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
