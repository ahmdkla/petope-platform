import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { db } from "@/lib/db";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { DealReference } from "@/components/deal-reference";
import { formatMoney } from "@/lib/money";
import { DEAL_METHOD_RULES } from "@/lib/deal-methods";
import { RulingForm } from "./ruling-form";

export const metadata: Metadata = { title: "Disputes" };
export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const disputes = await db.deal.findMany({
    where: { status: "DISPUTED", isTest: false },
    include: {
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
      middleman: { select: { id: true, displayName: true } },
      escalatedBy: { select: { displayName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { displayName: true } } },
      },
      logs: {
        where: { action: "DISPUTE_RULED" },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { displayName: true } } },
      },
    },
    orderBy: { escalatedAt: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Disputes"
        description="Escalated deals awaiting a ruling. The full room history is attached to each."
        actions={
          <Badge tone={disputes.length > 0 ? "danger" : "neutral"}>
            {disputes.length} open
          </Badge>
        }
      />

      <PageBody>
        <div className="max-w-4xl space-y-6">
          {disputes.length === 0 ? (
            <EmptyState
              icon={Gavel}
              message="No open disputes. Escalated deals appear here with both parties' history."
            />
          ) : (
            disputes.map((d) => (
              <Card key={d.id} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DealReference reference={d.reference} href={`/deals/${d.id}`} />
                      <Badge tone="danger">Disputed</Badge>
                      {d.method ? (
                        <Badge tone="neutral">{DEAL_METHOD_RULES[d.method].label}</Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 text-section font-semibold text-ink">
                      {d.projectName}
                    </h3>
                  </div>
                  <span className="text-right">
                    <span className="block text-meta text-ink-faint">At stake</span>
                    <span className="block font-mono tnum text-lead font-semibold text-ink">
                      {formatMoney(d.dealAmount, d.asset)}
                    </span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-5">
                  <Party label="Buyer" party={d.buyer} />
                  <Party label="Seller" party={d.seller} />
                  <Party label="Middleman" party={d.middleman} />
                </div>

                {d.escalationReason ? (
                  <div className="rounded-lg border border-warn/25 bg-warn-soft p-4">
                    <p className="text-meta font-medium text-warn">
                      Escalated{d.escalatedBy ? ` by ${d.escalatedBy.displayName}` : ""}
                    </p>
                    <p className="mt-1 text-body text-warn">{d.escalationReason}</p>
                  </div>
                ) : null}

                <details className="rounded-lg border border-line bg-raised">
                  <summary className="cursor-pointer px-4 py-3 text-body font-medium text-ink">
                    Room history ({d.messages.length} messages)
                  </summary>
                  <ul className="max-h-96 space-y-3 overflow-y-auto border-t border-line p-4">
                    {d.messages.map((m) => (
                      <li key={m.id} className="text-meta">
                        <span
                          className={`font-mono ${m.kind === "SYSTEM" ? "text-ink-faint" : "text-ink"}`}
                        >
                          {m.kind === "SYSTEM" ? "system" : (m.author?.displayName ?? "unknown")}
                        </span>{" "}
                        <span className="font-mono text-ink-faint">
                          {m.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap text-ink-muted">{m.body}</p>
                      </li>
                    ))}
                  </ul>
                </details>

                {d.logs.length > 0 ? (
                  <div className="space-y-2 border-t border-line pt-4">
                    <SectionTitle>Rulings recorded</SectionTitle>
                    {d.logs.map((l) => {
                      const meta = l.metadata as { outcome?: string; reasoning?: string } | null;
                      return (
                        <div key={l.id} className="rounded-md border border-line bg-raised p-3">
                          <p className="text-meta text-ink-faint">
                            <span className="font-mono text-ink">{l.actor.displayName}</span>{" "}
                            · {l.createdAt.toISOString().slice(0, 10)} ·{" "}
                            {meta?.outcome?.replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-meta text-ink-muted">{meta?.reasoning}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <RulingForm dealId={d.id} />
              </Card>
            ))
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}

function Party({
  label,
  party,
}: {
  label: string;
  party: { id: string; displayName: string | null } | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {party ? (
        <Avatar name={party.displayName ?? "??"} seed={party.id} size="sm" />
      ) : (
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-lg border border-dashed border-line text-ink-faint"
        >
          ?
        </span>
      )}
      <span>
        <span className="block text-meta text-ink-faint">{label}</span>
        <span className="block font-mono text-meta text-ink">
          {party?.displayName ?? "unassigned"}
        </span>
      </span>
    </div>
  );
}
