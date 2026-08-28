import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, FormSkeleton } from "@/components/skeleton";

export default function LoadingSettings() {
  return (
    <AppShell>
      <PageHeader title="Settings" description="Fee structure, collateral minimum, and concurrency limits." />
      <PageBody>
        <Loading label="Loading settings">
          <FormSkeleton fields={5} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
