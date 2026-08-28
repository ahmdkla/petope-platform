import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, ArticleSkeleton } from "@/components/skeleton";

export default function LoadingReport() {
  return (
    <AppShell>
      <PageHeader title="Report a scammer" description="Reports are reviewed before anyone is named publicly." />
      <PageBody>
        <Loading label="Loading the reporting form">
          <ArticleSkeleton blocks={3} asideLines={4} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
