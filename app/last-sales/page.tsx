import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, Store } from "lucide-react";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { EmptyState, Note } from "@/components/ui";
import { getRecentSales } from "@/lib/sales";
import { SaleRow } from "./sale-row";

export const metadata: Metadata = {
  title: "Last sales",
  description:
    "Every whitelist spot sold through an EXSAVERSE middleman, newest first.",
};
export const dynamic = "force-dynamic";

export default async function LastSalesPage() {
  const sales = await getRecentSales(60);

  return (
    <AppShell>
      <PageHeader
        title="Last sales"
        description="Every spot sold through a middleman, newest first. One entry per sale, so a listing that sells twice appears twice."
      />

      <PageBody>
        <div className="max-w-4xl space-y-5">
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
              {sales.length === 60 ? " of a longer history" : ""}.
            </p>
          ) : null}
        </div>
      </PageBody>
    </AppShell>
  );
}
