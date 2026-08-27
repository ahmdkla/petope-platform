import type { PaymentAsset } from "@prisma/client";
import { formatMoney } from "@/lib/money";

export type FeeLines = {
  dealAmount: bigint;
  mmFee: bigint;
  collateral: bigint;
  mintPrice: bigint;
  asset: PaymentAsset;
  atFloor: boolean;
};

/**
 * Deal amount / MM fee / collateral / total, always broken out.
 *
 * The fee is charged on top of the deal amount, so a single "total" figure
 * hides what the buyer is actually paying for. Collateral is shown but excluded
 * from the buyer's total — the seller sends that, not the buyer.
 */
export function FeeBreakdown({
  lines,
  estimate = false,
  className = "",
}: {
  lines: FeeLines;
  /** Listing cards show a projection, since quantity is chosen later. */
  estimate?: boolean;
  className?: string;
}) {
  const buyerTotal = lines.dealAmount + lines.mmFee + lines.mintPrice;

  return (
    <div className={`rounded-lg border border-line bg-raised p-4 ${className}`}>
      <dl className="space-y-2">
        <Line label="Deal amount" value={lines.dealAmount} asset={lines.asset} />
        <Line
          label="MM fee"
          value={lines.mmFee}
          asset={lines.asset}
          hint={lines.atFloor ? "minimum fee" : "5% of deal + collateral"}
        />
        {lines.mintPrice > 0n ? (
          <Line label="Mint price" value={lines.mintPrice} asset={lines.asset} />
        ) : null}

        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
          <dt className="text-body font-semibold text-ink">
            {estimate ? "Buyer pays (est.)" : "Buyer pays"}
          </dt>
          <dd className="font-mono tnum text-lead font-semibold text-ink">
            {formatMoney(buyerTotal, lines.asset)}
          </dd>
        </div>

        {lines.collateral > 0n ? (
          <div className="flex items-baseline justify-between gap-3 pt-1">
            <dt className="text-meta text-ink-muted">
              Seller collateral
              <span className="block text-ink-faint">held, then returned</span>
            </dt>
            <dd className="font-mono tnum text-meta text-ink-muted">
              {formatMoney(lines.collateral, lines.asset)}
            </dd>
          </div>
        ) : null}
      </dl>

      {estimate ? (
        <p className="mt-3 border-t border-line pt-2.5 text-meta text-ink-faint">
          Estimated from the listing. The exact fee is set when the middleman
          confirms the terms.
        </p>
      ) : null}
    </div>
  );
}

function Line({
  label,
  value,
  asset,
  hint,
}: {
  label: string;
  value: bigint;
  asset: PaymentAsset;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-meta text-ink-muted">
        {label}
        {hint ? <span className="block text-ink-faint">{hint}</span> : null}
      </dt>
      <dd className="font-mono tnum text-meta text-ink">{formatMoney(value, asset)}</dd>
    </div>
  );
}

/** Spots remaining and how many deals are chasing them. */
export function DemandLine({
  quantityRemaining,
  activeDeals,
  oversubscribed,
}: {
  quantityRemaining: number;
  activeDeals: number;
  oversubscribed: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
      <span className="text-ink-muted">
        <span className="font-mono tnum text-ink">{quantityRemaining}</span>{" "}
        {quantityRemaining === 1 ? "spot" : "spots"} left
      </span>
      {activeDeals > 0 ? (
        <>
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          <span className={oversubscribed ? "text-warn" : "text-ink-muted"}>
            <span className="font-mono tnum">{activeDeals}</span>{" "}
            {activeDeals === 1 ? "deal competing" : "deals competing"}
          </span>
        </>
      ) : null}
    </p>
  );
}
