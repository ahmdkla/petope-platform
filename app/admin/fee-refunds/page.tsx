import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { getMmFeeConfig } from "@/lib/admin-settings";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Badge, Card, EmptyState, Note } from "@/components/ui";
import { DealReference } from "@/components/deal-reference";
import { formatMoney } from "@/lib/money";
import { RefundForm } from "./refund-form";

export const metadata: Metadata = { title: "Fee refunds" };
export const dynamic = "force-dynamic";

export default async function FeeRefundsPage() {
  const { refundWindowHours } = await getMmFeeConfig();
  const now = new Date();
  const cutoff = new Date(now.getTime() - refundWindowHours * 3_600_000);

  const closed = await db.deal.findMany({
    where: {
      status: { in: ["COMPLETED", "REFUNDED", "CANCELLED"] },
      isTest: false,
      mmFee: { gt: 0 },
    },
    include: {
      buyer: { select: { displayName: true } },
      middleman: { select: { displayName: true } },
      logs: {
        where: { action: "MM_FEE_REFUNDED" },
        select: { id: true, createdAt: true, actor: { select: { displayName: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  return (
    <AppShell>
      <PageHeader
        title="Fee refunds"
        description={`The middleman fee is non-refundable by default. It is returned only when a deal involved a scammer and the request comes within ${refundWindowHours} hours of the deal closing.`}
      />

      <PageBody>
        <div className="max-w-4xl space-y-6">
          <Note>
            This is the only path that refunds a fee. An ordinary refund
            deliberately leaves it in place — the middleman did the work whatever
            the outcome.
          </Note>

          {closed.length === 0 ? (
            <EmptyState
              icon={Receipt}
              message="No deals have closed with a fee taken. Completed, refunded and cancelled deals appear here for 24 hours, which is the whole window a fee refund can be issued in."
            />
          ) : (
            <ul className="space-y-3">
              {closed.map((d) => {
                const closedAt = d.completedAt ?? d.cancelledAt ?? d.updatedAt;
                const inWindow = closedAt > cutoff;
                const refunded = d.logs[0];
                const hoursLeft = Math.max(
                  0,
                  Math.floor(
                    (closedAt.getTime() + refundWindowHours * 3_600_000 - now.getTime()) /
                      3_600_000,
                  ),
                );

                return (
                  <li key={d.id}>
                    <Card className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <DealReference
                              reference={d.reference}
                              href={`/deals/${d.id}`}
                            />
                            <Badge tone="neutral">{d.status.toLowerCase()}</Badge>
                            {refunded ? (
                              <Badge tone="ok">Fee refunded</Badge>
                            ) : inWindow ? (
                              <Badge tone="warn">{hoursLeft}h left</Badge>
                            ) : (
                              <Badge tone="neutral">Window closed</Badge>
                            )}
                          </div>
                          <p className="mt-1.5 text-body text-ink">{d.projectName}</p>
                          <p className="mt-0.5 text-meta text-ink-faint">
                            buyer{" "}
                            <span className="font-mono">{d.buyer.displayName}</span> ·
                            middleman{" "}
                            <span className="font-mono">
                              {d.middleman?.displayName ?? "none"}
                            </span>{" "}
                            · closed {closedAt.toISOString().slice(0, 10)}
                          </p>
                        </div>
                        <span className="text-right">
                          <span className="block text-meta text-ink-faint">Fee</span>
                          <span className="block font-mono tnum text-lead font-semibold text-ink">
                            {formatMoney(d.mmFee, d.asset)}
                          </span>
                        </span>
                      </div>

                      {refunded ? (
                        <p className="border-t border-line pt-3 text-meta text-ink-muted">
                          Refunded by{" "}
                          <span className="font-mono text-ink">
                            {refunded.actor.displayName}
                          </span>{" "}
                          on {refunded.createdAt.toISOString().slice(0, 10)}.
                        </p>
                      ) : inWindow ? (
                        <RefundForm dealId={d.id} />
                      ) : (
                        <p className="border-t border-line pt-3 text-meta text-ink-faint">
                          The {refundWindowHours}-hour window has closed.
                        </p>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}
