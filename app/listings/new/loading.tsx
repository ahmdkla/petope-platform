import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, FormSkeleton } from "@/components/skeleton";

export default function LoadingNewListing() {
  return (
    <AppShell>
      <PageHeader title="Post a listing" description="One form for both sides. Buyers post what they want; sellers post what they have." />
      <PageBody>
        <Loading label="Loading the listing form">
          <FormSkeleton fields={8} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
