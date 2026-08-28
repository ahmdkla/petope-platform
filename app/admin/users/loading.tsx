import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, ListSkeleton } from "@/components/skeleton";

export default function LoadingUsers() {
  return (
    <AppShell>
      <PageHeader title="Users" description="Roles, blacklist, and alt-account flags." />
      <PageBody>
        <Loading label="Loading accounts">
          <ListSkeleton rows={8} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
