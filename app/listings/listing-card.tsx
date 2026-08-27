import Link from "next/link";
import type { Listing } from "@prisma/client";
import { ExternalLink, Layers, Package } from "lucide-react";
import { formatAmount, formatMoney, resolveTotal, describePriceType } from "@/lib/money";
import { LISTING_TYPE_LABEL } from "@/lib/listing-meta";
import { Avatar, Badge } from "@/components/ui";
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
}: {
  listing: ListingRow;
  currentUserId: string | null;
}) {
  const total = resolveTotal(l.price, l.priceType, l.quantity);
  const isOwner = currentUserId === l.authorId;
  const sold = l.quantity - l.quantityRemaining;

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
          {l.promoted ? <Badge tone="accent">Promoted</Badge> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="neutral">
            <Layers aria-hidden className="size-3.5" strokeWidth={2} />
            {l.chain}
          </Badge>
          <Badge tone={l.specific === "GTD" ? "ok" : "warn"}>{l.specific}</Badge>
          <Badge tone="neutral">{LISTING_TYPE_LABEL[l.type]}</Badge>
          {l.status === "IN_DEAL" ? <Badge tone="info">In deal</Badge> : null}
        </div>

        {/* Price leads; the resolved total sits beside it so "for all" vs
            "each" cannot be misread. */}
        <div className="mt-5 flex items-end justify-between gap-3 rounded-lg border border-line bg-raised px-4 py-3">
          <div>
            <p className="text-meta text-ink-faint">
              Total for {l.quantity} {l.quantity === 1 ? "spot" : "spots"}
            </p>
            <p className="mt-0.5 font-mono tnum text-section-lg font-semibold text-ink">
              {formatMoney(total, l.payment)}
            </p>
          </div>
          <p className="pb-1 text-right font-mono tnum text-meta text-ink-muted">
            {formatAmount(l.price, l.payment)} {l.payment}
            <br />
            <span className="text-ink-faint">{describePriceType(l.priceType)}</span>
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-meta">
          <div>
            <dt className="text-ink-faint">Collateral</dt>
            <dd className="mt-0.5 font-mono tnum text-ink">
              {l.collateral ? formatMoney(l.collateral, l.payment) : "None"}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-ink-faint">
              <Package aria-hidden className="size-3.5" strokeWidth={2} />
              Remaining
            </dt>
            <dd className="mt-0.5 font-mono tnum text-ink">
              {l.quantityRemaining}
              {sold > 0 ? (
                <span className="text-ink-faint"> of {l.quantity}</span>
              ) : null}
            </dd>
          </div>
        </dl>

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
        />
      </footer>
    </article>
  );
}
