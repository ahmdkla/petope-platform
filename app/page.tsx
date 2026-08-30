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
import { shortReference } from "@/lib/reference";
import { getRecentSales } from "@/lib/sales";

export const metadata: Metadata = { title: "Overview" };
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
      // Same definition of "a sale" as /last-sales, from the same function, so
      // the two can never disagree about what counts.
      getRecentSales(5),
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

        {/* `min-w-0` on both columns: below `lg` these share one implicit `auto`
            track, whose minimum is the widest item's min-content. Without it a
            single wide row inside either column widens the track past the
            viewport and takes the whole page into horizontal scroll. */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-8">
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
                <EmptyState
                  icon={Store}
                  message="Nothing is on the marketplace yet. The newest buy and sell listings show up here as they are posted."
                  action={
                    <Link
                      href="/listings"
                      className="text-body font-medium text-accent-text underline underline-offset-2"
                    >
                      Post the first listing
                    </Link>
                  }
                />
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-200 hover:bg-raised sm:h-row sm:flex-nowrap sm:py-0"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              title={d.reference}
                              className="truncate font-mono text-meta text-ink-muted"
                            >
                              {shortReference(d.reference)}
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

          <aside className="min-w-0 space-y-6">
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <SectionTitle>Recent sales</SectionTitle>
                <Link
                  href="/last-sales"
                  className="flex items-center gap-1.5 text-meta font-medium text-accent-text transition-opacity duration-200 hover:opacity-80"
                >
                  All sales
                  <ArrowRight aria-hidden className="size-3.5" strokeWidth={2} />
                </Link>
              </div>
              {sales.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  message="Sales appear here the moment a middleman confirms both payments."
                />
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card shadow-card">
                  {sales.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                      <Avatar
                        name={d.middleman?.displayName ?? "??"}
                        seed={d.middleman?.id ?? d.id}
                        size="sm"
                        onShift={
                          d.middleman
                            ? isOnShift(d.middleman.workingHoursUtc)
                            : undefined
                        }
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
