import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, ListingSide } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { ListingFilters } from "./listing-filters";
import { ListingCard } from "./listing-card";
import { SideTabs } from "./side-tabs";
import { EmptyState } from "@/components/ui";
import { Store, Plus } from "lucide-react";

export const metadata: Metadata = { title: "Listings — EXSAVERSE" };
export const dynamic = "force-dynamic";

type SearchParams = {
  side?: string;
  chain?: string;
  type?: string;
  specific?: string;
  q?: string;
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  const side: ListingSide = sp.side === "BUY" ? "BUY" : "SELL";

  const where: Prisma.ListingWhereInput = {
    side,
    status: { in: ["ACTIVE", "IN_DEAL"] },
    ...(sp.chain ? { chain: sp.chain } : {}),
    ...(sp.type && sp.type !== "ALL"
      ? { type: sp.type as Prisma.EnumListingTypeFilter["equals"] }
      : {}),
    ...(sp.specific && sp.specific !== "ALL"
      ? { specific: sp.specific as Prisma.EnumSpotTypeFilter["equals"] }
      : {}),
    ...(sp.q ? { item: { contains: sp.q, mode: "insensitive" as const } } : {}),
  };

  const [listings, chains, buyCount, sellCount] = await Promise.all([
    db.listing.findMany({
      where,
      include: { author: { select: { id: true, displayName: true, isVerifiedMm: true } } },
      // Promoted (prem-listing) first, then newest.
      orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.listing.findMany({
      where: { status: { in: ["ACTIVE", "IN_DEAL"] } },
      select: { chain: true },
      distinct: ["chain"],
      orderBy: { chain: "asc" },
    }),
    db.listing.count({ where: { side: "BUY", status: { in: ["ACTIVE", "IN_DEAL"] } } }),
    db.listing.count({ where: { side: "SELL", status: { in: ["ACTIVE", "IN_DEAL"] } } }),
  ]);

  const filtered = Boolean(sp.chain || (sp.type && sp.type !== "ALL") || (sp.specific && sp.specific !== "ALL") || sp.q);

  return (
    <AppShell>
      <PageHeader
        title="Listings"
        description="Sellers post what they have; buyers post what they want. Every deal is held by a middleman until delivery is confirmed."
        actions={
          <Link
            href="/listings/new"
            className="inline-flex h-field cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-body font-medium text-accent-ink transition-all duration-200 hover:brightness-110"
          >
            <Plus aria-hidden className="size-[18px]" strokeWidth={2.25} />
            Post a listing
          </Link>
        }
      />

      <div className="border-b border-line px-8">
        <SideTabs side={side} buyCount={buyCount} sellCount={sellCount} />
      </div>

      <PageBody>
        <ListingFilters chains={chains.map((c) => c.chain)} />

        <div className="mt-6">
          {listings.length === 0 ? (
            <EmptyState
              icon={Store}
              message={
                filtered
                  ? "No listings match these filters. Clear one to widen the search."
                  : side === "SELL"
                    ? "No whitelist spots are for sale right now. New listings appear here as sellers post them."
                    : "Nobody is currently looking to buy. Buyer requests appear here as they are posted."
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} currentUserId={user?.id ?? null} />
              ))}
            </div>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}
