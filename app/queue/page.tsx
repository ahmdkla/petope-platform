import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Gavel } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, isMiddleman } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, EmptyState } from "@/components/ui";
import { DealStatusPill } from "@/components/deal-status-pill";
import { DealReference } from "@/components/deal-reference";
import { formatMoney } from "@/lib/money";
import { DEAL_METHOD_RULES } from "@/lib/deal-methods";
import { ClaimButton } from "./claim-button";

export const metadata: Metadata = { title: "Queue" };
export const dynamic = "force-dynamic";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/queue");
  if (!isMiddleman(user.role)) redirect("/");

  const { tab } = await searchParams;
  const mine = tab === "mine";

  const [unclaimed, assigned] = await Promise.all([
    db.deal.findMany({
      where: { status: "OPEN", middlemanId: null },
      include: {
        buyer: { select: { id: true, displayName: true } },
        seller: { select: { id: true, displayName: true } },
      },
      // Oldest first, so nothing sits unclaimed indefinitely.
      orderBy: { createdAt: "asc" },
    }),
    db.deal.findMany({
      where: {
        middlemanId: user.id,
        status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] },
      },
      include: {
        buyer: { select: { id: true, displayName: true } },
        seller: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows = mine ? assigned : unclaimed;

  return (
    <AppShell>
      <PageHeader
        title="Middleman queue"
        description="Unclaimed tickets and the deals assigned to you."
      />

      <div className="border-b border-line px-4 sm:px-6 lg:px-8">
        <div role="tablist" aria-label="Queue" className="-mb-px flex gap-1">
          <Tab href="/queue" active={!mine} label="Unclaimed" count={unclaimed.length} />
          <Tab
            href="/queue?tab=mine"
            active={mine}
            label="Assigned to me"
            count={assigned.length}
          />
        </div>
      </div>

      <PageBody>
        {rows.length === 0 ? (
          <EmptyState
            icon={mine ? Gavel : Inbox}
            message={
              mine
                ? "You have no active deals. Claim one from the unclaimed queue to get started."
                : "No unclaimed tickets. New deals appear here the moment a buyer or seller opens one."
            }
            action={
              mine ? (
                <Link
                  href="/queue"
                  className="text-body font-medium text-accent-text underline underline-offset-2"
                >
                  View unclaimed
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((d) => {
              const rule = d.method ? DEAL_METHOD_RULES[d.method] : null;
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-5 rounded-lg border border-line bg-card p-5 shadow-card transition-colors duration-200 hover:border-line-strong"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DealReference reference={d.reference} href={`/deals/${d.id}`} />
                      <DealStatusPill status={d.status} />
                      {rule ? <Badge tone="neutral">{rule.label}</Badge> : null}
                    </div>
                    <p className="mt-1.5 truncate text-section font-semibold text-ink">
                      {d.projectName}
                    </p>
                    <p className="mt-1 text-meta text-ink-muted">
                      {d.chain} · {d.quantity} {d.quantity === 1 ? "spot" : "spots"} ·{" "}
                      {d.specific}
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <Pair label="Buyer" party={d.buyer} />
                    <Pair label="Seller" party={d.seller} />
                  </div>

                  <div className="text-right">
                    <p className="text-meta text-ink-faint">Deal amount</p>
                    <p className="font-mono tnum text-section font-semibold text-ink">
                      {formatMoney(d.dealAmount, d.asset)}
                    </p>
                  </div>

                  {mine ? (
                    <Link
                      href={`/deals/${d.id}`}
                      className="inline-flex h-field items-center rounded-md border border-line bg-raised px-4 text-body font-medium text-ink transition-colors duration-200 hover:border-line-strong"
                    >
                      Open room
                    </Link>
                  ) : (
                    <ClaimButton dealId={d.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </AppShell>
  );
}

function Pair({
  label,
  party,
}: {
  label: string;
  party: { id: string; displayName: string | null };
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar name={party.displayName ?? "??"} seed={party.id} size="sm" />
      <span>
        <span className="block text-meta text-ink-faint">{label}</span>
        <span className="block font-mono text-meta text-ink">
          {party.displayName ?? "unnamed"}
        </span>
      </span>
    </div>
  );
}

function Tab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      role="tab"
      aria-selected={active}
      href={href}
      className={`flex h-12 items-center gap-2 border-b-2 px-4 text-body transition-colors duration-200 ${
        active
          ? "border-accent font-semibold text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`rounded-md px-1.5 py-0.5 font-mono tnum text-meta ${
          active ? "bg-accent-soft text-accent-text" : "bg-raised text-ink-faint"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
