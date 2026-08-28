import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { ReviewForm } from "./review-form";
import {
  REPORT_CATEGORY_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
} from "@/lib/report-meta";

export const metadata: Metadata = { title: "Reports — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [pending, decided] = await Promise.all([
    db.scammerReport.findMany({
      where: { status: "PENDING" },
      include: {
        reporter: { select: { id: true, displayName: true } },
        accusedUser: { select: { id: true, displayName: true, status: true } },
        deal: { select: { id: true, reference: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.scammerReport.findMany({
      where: { status: { not: "PENDING" } },
      include: {
        reviewedBy: { select: { displayName: true } },
        accusedUser: { select: { displayName: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Reported accounts and impersonators awaiting review. Nothing is public until a report is upheld."
        actions={<Badge tone={pending.length > 0 ? "warn" : "neutral"}>{pending.length} pending</Badge>}
      />

      <PageBody>
        <div className="max-w-4xl space-y-8">
          <section className="space-y-4">
            <SectionTitle>Awaiting review</SectionTitle>
            {pending.length === 0 ? (
              <EmptyState icon={ShieldCheck} message="Nothing waiting. New reports appear here." />
            ) : (
              pending.map((r) => (
                <Card key={r.id} className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lead font-semibold text-ink">
                          {r.accusedHandle}
                        </span>
                        <Badge tone={r.category === "DM_IMPERSONATION" ? "danger" : "warn"}>
                          {REPORT_CATEGORY_LABEL[r.category]}
                        </Badge>
                        {r.accusedUser ? (
                          <Badge tone="info">Account matched</Badge>
                        ) : (
                          <Badge tone="neutral">No account here</Badge>
                        )}
                      </div>
                      <p className="mt-1.5 flex items-center gap-2 text-meta text-ink-faint">
                        <Avatar
                          name={r.reporter.displayName ?? "??"}
                          seed={r.reporter.id}
                          size="sm"
                        />
                        reported by{" "}
                        <span className="font-mono text-ink">
                          {r.reporter.displayName}
                        </span>{" "}
                        · {r.createdAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap rounded-lg border border-line bg-raised p-4 text-body text-ink">
                    {r.evidence}
                  </p>

                  <div className="flex flex-wrap gap-4">
                    {r.evidenceUrl ? (
                      <a
                        href={r.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-meta font-medium text-accent-text underline underline-offset-2"
                      >
                        Open evidence link
                      </a>
                    ) : null}
                    {r.deal ? (
                      <Link
                        href={`/deals/${r.deal.id}`}
                        className="font-mono text-meta text-accent-text underline underline-offset-2"
                      >
                        {r.deal.reference}
                      </Link>
                    ) : null}
                  </div>

                  <ReviewForm
                    reportId={r.id}
                    canBlacklist={Boolean(r.accusedUser)}
                    alreadyBlacklisted={r.accusedUser?.status === "BLACKLISTED"}
                    accusedName={r.accusedUser?.displayName ?? r.accusedHandle}
                  />
                </Card>
              ))
            )}
          </section>

          {decided.length > 0 ? (
            <section className="space-y-4">
              <SectionTitle>Decided</SectionTitle>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card shadow-card">
                {decided.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-body text-ink">
                        {r.accusedHandle}
                      </span>
                      <span className="block text-meta text-ink-faint">
                        {REPORT_CATEGORY_LABEL[r.category]} · reviewed by{" "}
                        <span className="font-mono">{r.reviewedBy?.displayName}</span>
                      </span>
                      {r.reviewNote ? (
                        <span className="mt-1 block text-meta text-ink-muted">
                          {r.reviewNote}
                        </span>
                      ) : null}
                    </span>
                    <Badge tone={REPORT_STATUS_TONE[r.status]}>
                      {REPORT_STATUS_LABEL[r.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </PageBody>
    </AppShell>
  );
}
