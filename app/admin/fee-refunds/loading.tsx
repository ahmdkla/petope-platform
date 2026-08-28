import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, StackSkeleton } from "@/components/skeleton";

export default function LoadingFeeRefunds() {
  return (
    <AppShell>
      <PageHeader title="Fee refunds" description="Recently closed deals and the window remaining on each." />
      <PageBody>
        <Loading label="Loading closed deals">
          <StackSkeleton cards={4} lines={3} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
