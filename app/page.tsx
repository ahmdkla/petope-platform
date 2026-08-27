import type { Metadata } from "next";
import Link from "next/link";
import { Store, Handshake, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { DealStatusPill } from "@/components/deal-status-pill";
import { formatMoney, resolveTotal } from "@/lib/money";
import { ImpersonationNotice } from "@/components/impersonation-notice";
import { currentShiftWindow, isOnShift } from "@/lib/shifts";

export const metadata: Metadata = { title: "Overview — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  const [sellCount, buyCount, middlemen, completedCount, recent, myDeals, sales] =
    await Promise.all([
      db.listing.count({ where: { side: "SELL", status: "ACTIVE", isTest: false } }),
      db.listing.count({ where: { side: "BUY", status: "ACTIVE", isTest: false } }),
      // Fetched rather than counted: "on shift" depends on each one's window.
      db.user.findMany({
        where: { role: { in: ["MIDDLEMAN", "MAIN_MIDDLEMAN"] }, status: "ACTIVE" },
        select: { id: true, workingHoursUtc: true },
      }),
      // Public figures exclude test-suite deals: the ledger is append-only so
      // they cannot be deleted, but they are not trade history.
      db.deal.count({ where: { status: "COMPLETED", isTest: false } }),
      db.listing.findMany({
        where: { status: "ACTIVE", isTest: false },
        orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
        take: 6,
        include: { author: { select: { id: true, displayName: true } } },
      }),
      user
        ? db.deal.findMany({
            where: {
              OR: [{ buyerId: user.id }, { sellerId: user.id }, { middlemanId: user.id }],
              status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] },
              isTest: false,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
      db.deal.findMany({
        where: { status: "COMPLETED", isTest: false },
        orderBy: { completedAt: "desc" },
        take: 5,
        include: { middleman: { select: { id: true, displayName: true } } },
      }),
    ]);

  const shift = currentShiftWindow();
  const onShiftCount = middlemen.filter((m) => isOnShift(m.workingHoursUtc)).length;

  return (
    <AppShell>
      <PageHeader
        title="Overview"
        description="Whitelist marketplace with middleman escrow. A middleman holds funds and collateral until delivery is confirmed."
      />

      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Store} label="Spots for sale" value={sellCount} tone="sell" href="/listings?side=SELL" />
          <Stat icon={Handshake} label="Buyer requests" value={buyCount} tone="buy" href="/listings?side=BUY" />
          <Stat
            icon={ShieldCheck}
            label="Middlemen on shift"
            value={onShiftCount}
            tone="accent"
            href="/middlemen?filter=on-shift"
            note={shift.label}
          />
          <Stat icon={CheckCircle2} label="Deals completed" value={completedCount} tone="ok" />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-8">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <SectionTitle>Latest listings</SectionTitle>
                <Link
                  href="/listings"
                  className="flex items-center gap-1.5 text-body font-medium text-accent-text transition-opacity duration-200 hover:opacity-80"
                >
                  View marketplace
                  <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
                </Link>
              </div>

              {recent.length === 0 ? (
                <EmptyState icon={Store} message="No listings have been posted yet." />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {recent.map((l) => (
                    <li key={l.id}>
                      <Link
                        href="/listings"
                        className="flex h-full flex-col justify-between gap-3 rounded-lg border border-line bg-card p-4 shadow-card transition-colors duration-200 hover:border-line-strong"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-lead font-semibold text-ink">
                            {l.item}
                          </span>
                          <Badge tone={l.side === "SELL" ? "sell" : "buy"}>
                            {l.side === "SELL" ? "Selling" : "Buying"}
                          </Badge>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <span className="text-meta text-ink-muted">{l.chain}</span>
                          <span className="font-mono tnum text-lead font-semibold text-ink">
                            {formatMoney(
                              resolveTotal(l.price, l.priceType, l.quantity),
                              l.payment,
                            )}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {user ? (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <SectionTitle>Your open deals</SectionTitle>
                  <Link
                    href="/deals"
                    className="flex items-center gap-1.5 text-body font-medium text-accent-text transition-opacity duration-200 hover:opacity-80"
                  >
                    All deals
                    <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
                  </Link>
                </div>

                {myDeals.length === 0 ? (
                  <EmptyState
                    icon={Handshake}
                    message="You have no open deals. Opening one from a listing puts it here."
                  />
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card shadow-card">
                    {myDeals.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/deals/${d.id}`}
                          className="flex h-row items-center justify-between gap-4 px-4 transition-colors duration-200 hover:bg-raised"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="truncate font-mono text-meta text-ink-muted">
                              {d.reference}
                            </span>
                            <span className="truncate text-body text-ink">
                              {d.projectName}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <DealStatusPill status={d.status} />
                            <span className="font-mono tnum text-body text-ink">
                              {formatMoney(d.dealAmount, d.asset)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </div>

          <aside className="space-y-6">
            <section>
              <SectionTitle className="mb-4">Recent sales</SectionTitle>
              {sales.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  message="Completed deals appear here once the first one closes."
                />
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card shadow-card">
                  {sales.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                      <Avatar
                        name={d.middleman?.displayName ?? "??"}
                        seed={d.middlemanId ?? d.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">
                          {d.projectName}
                        </span>
                        <span className="block text-meta text-ink-faint">
                          secured by{" "}
                          <span className="font-mono">
                            {d.middleman?.displayName ?? "unknown"}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono tnum text-body font-semibold text-ok">
                        {formatMoney(d.dealAmount, d.asset)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Card className="space-y-3">
              <SectionTitle>How escrow works</SectionTitle>
              <ol className="space-y-2.5 text-body text-ink-muted">
                <Step n={1}>Open a deal from a listing. A middleman claims it.</Step>
                <Step n={2}>Both parties agree terms and confirm the method.</Step>
                <Step n={3}>Buyer sends payment, seller sends collateral, off-platform.</Step>
                <Step n={4}>The middleman checks each Solscan link personally.</Step>
                <Step n={5}>After delivery, funds release and collateral returns.</Step>
              </ol>
              <p className="border-t border-line pt-3 text-meta text-ink-faint">
                Payments happen outside the platform. Nothing here connects to a
                wallet or moves money on its own.
              </p>
            </Card>

            <ImpersonationNotice />
          </aside>
        </div>
      </PageBody>
    </AppShell>
  );
}

const STAT_TONE = {
  sell: "text-sell",
  buy: "text-buy",
  accent: "text-accent-text",
  ok: "text-ok",
} as const;

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  href,
  note,
}: {
  icon: typeof Store;
  label: string;
  value: number;
  tone: keyof typeof STAT_TONE;
  href?: string;
  note?: string;
}) {
  const body = (
    <>
      <span className={`flex items-center gap-2 text-meta ${STAT_TONE[tone]}`}>
        <Icon aria-hidden className="size-4" strokeWidth={2} />
        {label}
      </span>
      <span className="mt-2 block font-mono tnum text-title font-bold text-ink">
        {value.toLocaleString("en-US")}
      </span>
      {note ? (
        <span className="mt-1 block font-mono text-meta text-ink-faint">{note}</span>
      ) : null}
    </>
  );

  const base =
    "block rounded-xl border border-line bg-card px-5 py-4 shadow-card transition-colors duration-200";

  return href ? (
    <Link href={href} className={`${base} hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-raised font-mono tnum text-meta font-semibold text-ink-muted">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
