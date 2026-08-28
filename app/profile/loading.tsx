import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, FormSkeleton } from "@/components/skeleton";

export default function LoadingProfile() {
  return (
    <AppShell>
      <PageHeader title="Profile" description="Your account, wallet references, and published details." />
      <PageBody>
        <Loading label="Loading your profile">
          <FormSkeleton fields={4} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
