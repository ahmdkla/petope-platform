import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { ReportForm } from "./report-form";
import {
  REPORT_CATEGORY_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
} from "@/lib/report-meta";

export const metadata: Metadata = { title: "Report a scammer — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/report");

  const mine = await db.scammerReport.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <AppShell>
      <PageHeader
        title="Report a scammer"
        description="Reports go to the middleman team. Nothing is published until an admin has reviewed it."
        actions={
          <Link
            href="/blacklist"
            className="inline-flex h-field items-center rounded-md border border-line bg-raised px-4 text-body font-medium text-ink transition-colors duration-200 hover:border-line-strong"
          >
            View blacklist
          </Link>
        }
      />

      <PageBody>
        <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ReportForm />

          <aside className="space-y-4">
            <Card className="space-y-3">
              <SectionTitle>Your reports</SectionTitle>
              {mine.length === 0 ? (
                <p className="text-body text-ink-muted">
                  You have not filed any reports.
                </p>
              ) : (
                <ul className="space-y-3">
                  {mine.map((r) => (
                    <li key={r.id} className="rounded-md border border-line bg-raised p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-meta text-ink">
                          {r.accusedHandle}
                        </span>
                        <Badge tone={REPORT_STATUS_TONE[r.status]}>
                          {REPORT_STATUS_LABEL[r.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-meta text-ink-faint">
                        {REPORT_CATEGORY_LABEL[r.category]}
                      </p>
                      {r.reviewNote ? (
                        <p className="mt-1.5 text-meta text-ink-muted">{r.reviewNote}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-2.5">
              <SectionTitle>Before you file</SectionTitle>
              <p className="text-meta text-ink-muted">
                Middlemen never message you first. If someone direct-messaged you
                claiming to be staff, that alone is worth reporting — pick the
                impersonation category.
              </p>
              <p className="text-meta text-ink-muted">
                Check the handle against the roster first. Impersonators copy
                names and avatars exactly.
              </p>
              <Link
                href="/middlemen"
                className="inline-flex text-meta font-medium text-accent-text underline underline-offset-2"
              >
                Open the roster
              </Link>
            </Card>
          </aside>
        </div>
      </PageBody>
    </AppShell>
  );
}
