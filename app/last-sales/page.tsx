import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, Store } from "lucide-react";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { EmptyState, Note } from "@/components/ui";
import { getSalesFeed } from "@/lib/sales";
import { StatsRail } from "./stats-rail";
import { SaleRow } from "./sale-row";

export const metadata: Metadata = {
  title: "Last sales",
  description:
    "Every whitelist spot sold through an EXSAVERSE middleman, newest first.",
};
export const dynamic = "force-dynamic";

export default async function LastSalesPage() {
  const { sales, stats } = await getSalesFeed(60);

  return (
    <AppShell>
      <PageHeader
        title="Last sales"
        description="Every spot sold through a middleman, newest first. One entry per sale, so a listing that sells twice appears twice."
      />

      <PageBody>
        {/* Wide list, stats rail beside it. The rows carry five fields and read
            better with the room; the rail puts the space that was empty to use
            rather than stretching the list past what it needs. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
          <div className="min-w-0 space-y-5">
          <Note>
            A sale is recorded the moment a middleman confirms both payments —
            not when a listing runs out. Buyers and sellers are never named here;
            the middleman is, because who secured a deal is the part worth
            checking.
          </Note>

          {sales.length === 0 ? (
            <EmptyState
              icon={Receipt}
              message="No sales yet. A deal appears here as soon as its payments are confirmed, even if the listing still has spots left."
              action={
                <Link
                  href="/listings"
                  className="text-body font-medium text-accent-text underline underline-offset-2"
                >
                  Browse the marketplace
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card shadow-card">
              {sales.map((s) => (
                <SaleRow key={s.id} sale={s} />
              ))}
            </ul>
          )}

          {sales.length > 0 ? (
            <p className="flex items-center gap-2 text-meta text-ink-faint">
              <Store aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
              Showing the {sales.length} most recent
              {stats.totalSales > sales.length
                ? ` of ${stats.totalSales.toLocaleString("en-US")}`
                : ""}
              .
            </p>
          ) : null}
          </div>

          <StatsRail stats={stats} />
        </div>
      </PageBody>
    </AppShell>
  );
}
