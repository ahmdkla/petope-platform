import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, ArticleSkeleton } from "@/components/skeleton";

export default function LoadingMints() {
  return (
    <AppShell>
      <PageHeader title="Mint schedule" description="When projects mint. Deals link to an entry here, and the release timers run from it." />
      <PageBody>
        <Loading label="Loading the mint schedule">
          <ArticleSkeleton blocks={4} asideLines={4} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
