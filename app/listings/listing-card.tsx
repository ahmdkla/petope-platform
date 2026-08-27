import Link from "next/link";
import type { Listing } from "@prisma/client";
import { ExternalLink, Layers, Package } from "lucide-react";
import { formatAmount, formatMoney, resolveTotal, describePriceType } from "@/lib/money";
import { LISTING_TYPE_LABEL } from "@/lib/listing-meta";
import { Avatar, Badge } from "@/components/ui";
import { DemandLine, FeeBreakdown } from "@/components/fee-breakdown";
import type { ListingDemand } from "@/lib/listing-demand";
import { ListingActions } from "./listing-actions";

export type ListingRow = Listing & {
  author: { id: string; displayName: string | null; isVerifiedMm: boolean };
};

/**
 * A listing should look like something you'd want to buy: item name and price
 * lead, badges carry chain and spot type, seller identity is visible.
 */
export function ListingCard({
  listing: l,
  currentUserId,
  demand,
  feeEstimate,
}: {
  listing: ListingRow;
  currentUserId: string | null;
  demand: ListingDemand;
  /** Projected fee for taking every remaining spot. */
  feeEstimate: bigint;
}) {
  const total = resolveTotal(l.price, l.priceType, l.quantityRemaining || l.quantity);
  const isOwner = currentUserId === l.authorId;
  const sold = l.quantity - l.quantityRemaining;
  const soldOut = l.status === "SOLD_OUT" || l.quantityRemaining < 1;

  return (
    <article
      className={`flex flex-col rounded-xl border bg-card shadow-card transition-colors duration-200 hover:border-line-strong ${
        l.promoted ? "border-accent-line" : "border-line"
      }`}
    >
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* BUY and SELL are distinguishable at a glance. */}
            <Badge tone={l.side === "SELL" ? "sell" : "buy"}>
              {l.side === "SELL" ? "Selling" : "Buying"}
            </Badge>
            <h3 className="mt-2.5 truncate text-section font-semibold tracking-tight text-ink">
              {l.item}
            </h3>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-1.5">
            {l.promoted ? <Badge tone="accent">Promoted</Badge> : null}
            {soldOut ? <Badge tone="danger">Sold out</Badge> : null}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="neutral">
            <Layers aria-hidden className="size-3.5" strokeWidth={2} />
            {l.chain}
          </Badge>
          <Badge tone={l.specific === "GTD" ? "ok" : "warn"}>{l.specific}</Badge>
          <Badge tone="neutral">{LISTING_TYPE_LABEL[l.type]}</Badge>
        </div>

        {/* Supply and competition, before any price talk. */}
        <div className="mt-3">
          <DemandLine
            quantityRemaining={l.quantityRemaining}
            activeDeals={demand.activeDeals}
            oversubscribed={demand.oversubscribed}
          />
        </div>

        {/* Price leads; the resolved total sits beside it so "for all" vs
            "each" cannot be misread. */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-meta text-ink-faint">
              {formatAmount(l.price, l.payment)} {l.payment}{" "}
              {describePriceType(l.priceType)}
            </p>
            <p className="mt-0.5 font-mono tnum text-section-lg font-semibold text-ink">
              {formatMoney(total, l.payment)}
            </p>
          </div>
          {sold > 0 ? (
            <p className="flex items-center gap-1.5 pb-1 text-meta text-ink-faint">
              <Package aria-hidden className="size-3.5" strokeWidth={2} />
              <span className="font-mono tnum">
                {sold}/{l.quantity} sold
              </span>
            </p>
          ) : null}
        </div>

        <FeeBreakdown
          className="mt-4"
          estimate
          lines={{
            dealAmount: total,
            mmFee: feeEstimate,
            collateral: l.collateral ?? 0n,
            mintPrice: 0n,
            asset: l.payment,
            atFloor: false,
          }}
        />

        {l.projectLink ? (
          <a
            href={l.projectLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-meta font-medium text-accent-text underline underline-offset-2"
          >
            Project link
            <ExternalLink aria-hidden className="size-3.5" strokeWidth={2} />
          </a>
        ) : null}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <Link
          href={`/u/${l.author.id}`}
          className="flex min-w-0 items-center gap-2.5 transition-opacity duration-200 hover:opacity-80"
        >
          <Avatar
            name={l.author.displayName ?? "??"}
            seed={l.author.id}
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate font-mono text-meta text-ink">
              {l.author.displayName ?? "unnamed"}
            </span>
            {l.author.isVerifiedMm ? (
              <span className="block text-meta text-accent-text">Verified MM</span>
            ) : (
              <span className="block text-meta text-ink-faint">
                {l.side === "SELL" ? "Seller" : "Buyer"}
              </span>
            )}
          </span>
        </Link>

        <ListingActions
          listingId={l.id}
          side={l.side}
          isOwner={isOwner}
          signedIn={Boolean(currentUserId)}
          acceptsOffers={l.acceptsOffers}
          status={l.status}
          asset={l.payment}
          quantityRemaining={l.quantityRemaining}
          priceType={l.priceType}
          oversubscribed={demand.oversubscribed}
        />
      </footer>
    </article>
  );
}
