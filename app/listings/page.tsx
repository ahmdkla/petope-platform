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
import { getListingDemandMap } from "@/lib/listing-demand";
import { getMmFeeConfig } from "@/lib/admin-settings";
import { computeMmFee } from "@/lib/mm-fee";
import { resolveTotal } from "@/lib/money";
import { Store, Plus } from "lucide-react";
import { NewListingButton } from "./new-listing-modal";

export const metadata: Metadata = { title: "Listings — EXSAVERSE" };
export const dynamic = "force-dynamic";

type SearchParams = {
  side?: string;
  status?: string;
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
  const soldOutOnly = sp.status === "sold-out";

  const where: Prisma.ListingWhereInput = {
    // The sold-out view spans both sides: it is a state, not a side.
    ...(soldOutOnly ? {} : { side }),
    // Sold-out listings stay visible; they just take no new deals.
    status: soldOutOnly ? "SOLD_OUT" : { in: ["ACTIVE", "SOLD_OUT"] },
    // Test fixtures never appear in a public feed.
    isTest: false,
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
      where: { status: { in: ["ACTIVE", "SOLD_OUT"] }, isTest: false },
      select: { chain: true },
      distinct: ["chain"],
      orderBy: { chain: "asc" },
    }),
    db.listing.count({ where: { side: "BUY", status: { in: ["ACTIVE", "SOLD_OUT"] }, isTest: false } }),
    db.listing.count({ where: { side: "SELL", status: { in: ["ACTIVE", "SOLD_OUT"] }, isTest: false } }),
  ]);

  // The modal needs the same prefill the standalone route uses.
  const [lastListing, allChains] = await Promise.all([
    user
      ? db.listing.findFirst({
          where: { authorId: user.id },
          orderBy: { createdAt: "desc" },
          select: { side: true, chain: true, payment: true, specific: true, type: true },
        })
      : Promise.resolve(null),
    db.listing.findMany({
      select: { chain: true },
      distinct: ["chain"],
      orderBy: { chain: "asc" },
    }),
  ]);
  const formChains = allChains.map((c) => c.chain);
  const formDefaults = lastListing ?? null;

  // Batched so the feed does not fire two queries per card.
  const [demandMap, feeConfig] = await Promise.all([
    getListingDemandMap(listings.map((l) => l.id)),
    getMmFeeConfig(),
  ]);

  const filtered = Boolean(sp.chain || (sp.type && sp.type !== "ALL") || (sp.specific && sp.specific !== "ALL") || sp.q);

  return (
    <AppShell>
      <PageHeader
        title={soldOutOnly ? "Sold out" : "Listings"}
        description="Sellers post what they have; buyers post what they want. Every deal is held by a middleman until delivery is confirmed."
        actions={
          user ? (
            <NewListingButton knownChains={formChains} defaults={formDefaults} />
          ) : (
            <Link
              href="/sign-in?next=/listings"
              className="inline-flex h-field cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-body font-medium text-accent-ink transition-all duration-200 hover:brightness-110"
            >
              <Plus aria-hidden className="size-[18px]" strokeWidth={2.25} />
              Post a listing
            </Link>
          )
        }
      />

      {soldOutOnly ? null : (
        <div className="border-b border-line px-4 sm:px-6 lg:px-8">
          <SideTabs side={side} buyCount={buyCount} sellCount={sellCount} />
        </div>
      )}

      <PageBody>
        <ListingFilters chains={chains.map((c) => c.chain)} />

        <div className="mt-6">
          {listings.length === 0 ? (
            <EmptyState
              icon={Store}
              message={
                filtered
                  ? "No listings match these filters. Clear one to widen the search."
                  : soldOutOnly
                    ? "Nothing is sold out yet. Listings appear here once every spot is taken."
                    : side === "SELL"
                    ? "No whitelist spots are for sale right now. New listings appear here as sellers post them."
                    : "Nobody is currently looking to buy. Buyer requests appear here as they are posted."
              }
            />
          ) : (
            <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))]">
              {listings.map((l) => {
                const demand = demandMap.get(l.id) ?? {
                  quantityRemaining: l.quantityRemaining,
                  activeDeals: 0,
                  spotsInFlight: 0,
                  oversubscribed: false,
                };
                // Projected for taking every remaining spot.
                const spots = l.quantityRemaining || l.quantity;
                const estimate = computeMmFee(
                  {
                    dealAmount: resolveTotal(l.price, l.priceType, spots),
                    collateral: l.collateral,
                    asset: l.payment,
                  },
                  feeConfig,
                );
                return (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    currentUserId={user?.id ?? null}
                    demand={demand}
                    feeEstimate={estimate.fee}
                  />
                );
              })}
            </div>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}
