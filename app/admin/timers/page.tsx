import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Timer } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Badge, Card, EmptyState, Note, SectionTitle } from "@/components/ui";
import { DealReference } from "@/components/deal-reference";
import { RunTimersButton } from "./run-button";

export const metadata: Metadata = { title: "Release timers — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function TimersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/admin/timers");
  if (user.role !== "ADMIN" && user.role !== "MAIN_MIDDLEMAN") redirect("/");

  const now = new Date();
  const running = await db.deal.findMany({
    where: {
      status: "AWAITING_CONFIRMATION",
      OR: [
        { sellerDeliveryDeadline: { not: null } },
        { buyerConfirmDeadline: { not: null } },
        { autoReleaseAt: { not: null } },
      ],
    },
    select: {
      id: true,
      reference: true,
      projectName: true,
      timersPausedAt: true,
      receiptConfirmedAt: true,
      sellerDeliveryDeadline: true,
      buyerConfirmDeadline: true,
      autoReleaseAt: true,
    },
    orderBy: { autoReleaseAt: "asc" },
  });

  const due = running.filter(
    (d) =>
      !d.timersPausedAt &&
      !d.receiptConfirmedAt &&
      [d.sellerDeliveryDeadline, d.buyerConfirmDeadline, d.autoReleaseAt].some(
        (t) => t !== null && t <= now,
      ),
  );

  return (
    <AppShell>
      <PageHeader
        title="Release timers"
        description="Deals with a running release window, and the manual runner for due timers."
        actions={<RunTimersButton dueCount={due.length} />}
      />

      <PageBody>
        <div className="max-w-4xl space-y-6">
          <Note>
            No timer here moves money. An elapsed window changes what the
            middleman is <em>allowed</em> to do — releasing funds is always a
            separate, explicit step performed by a person. The scheduled job is
            build-order step 6; this button calls the same function it will.
          </Note>

          {running.length === 0 ? (
            <EmptyState
              icon={Timer}
              message="No deals have a running release timer. Timers start when a deal reaches awaiting confirmation."
            />
          ) : (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionTitle>Running</SectionTitle>
                <Badge tone={due.length > 0 ? "warn" : "neutral"}>
                  {due.length} due
                </Badge>
              </div>

              <ul className="divide-y divide-line">
                {running.map((d) => (
                  <li key={d.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DealReference reference={d.reference} href={`/deals/${d.id}`} />
                      <span className="text-body text-ink">{d.projectName}</span>
                      {d.timersPausedAt ? <Badge tone="neutral">Paused</Badge> : null}
                      {d.receiptConfirmedAt ? <Badge tone="ok">Receipt confirmed</Badge> : null}
                    </div>
                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                      <Deadline label="Seller delivery" at={d.sellerDeliveryDeadline} now={now} />
                      <Deadline label="Buyer confirm" at={d.buyerConfirmDeadline} now={now} />
                      <Deadline label="Buyer silence" at={d.autoReleaseAt} now={now} />
                    </dl>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}

function Deadline({
  label,
  at,
  now,
}: {
  label: string;
  at: Date | null;
  now: Date;
}) {
  if (!at) return null;
  const elapsed = at <= now;
  return (
    <div className="flex gap-2 text-meta">
      <dt className="text-ink-faint">{label}</dt>
      <dd className={`font-mono tnum ${elapsed ? "text-warn" : "text-ink"}`}>
        {at.toISOString().replace("T", " ").slice(0, 16)}
        {elapsed ? " (due)" : ""}
      </dd>
    </div>
  );
}
