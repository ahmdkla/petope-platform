import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, ListSkeleton } from "@/components/skeleton";

export default function LoadingBlacklist() {
  return (
    <AppShell>
      <PageHeader title="Blacklist" description="Accounts removed from EXSAVERSE after a reviewed report." />
      <PageBody>
        <Loading label="Loading the blacklist">
          <ListSkeleton rows={4} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
