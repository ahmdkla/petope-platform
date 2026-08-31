import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, Bar, Tile } from "@/components/skeleton";

export default function LoadingBlacklist() {
  return (
    <AppShell>
      <PageHeader title="Blacklist" description="Accounts removed from EXSAVERSE after a reviewed report." />
      <PageBody>
        <Loading label="Loading the blacklist">
          <div className="grid max-w-6xl gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-lg border border-line bg-card p-5 shadow-card"
              >
                <Tile className="size-10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bar className="h-4 w-36" />
                  <Bar className="h-4 w-full" />
                  <Bar className="h-3.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </Loading>
      </PageBody>
    </AppShell>
  );
}
