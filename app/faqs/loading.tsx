import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Loading, ArticleSkeleton } from "@/components/skeleton";

export default function LoadingFaqs() {
  return (
    <AppShell>
      <PageHeader title="How escrow works" description="Every deal method, what each party sends, and when funds move." />
      <PageBody>
        <Loading label="Loading the escrow guide">
          <ArticleSkeleton blocks={7} />
        </Loading>
      </PageBody>
    </AppShell>
  );
}
