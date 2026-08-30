import { Avatar, Badge } from "@/components/ui";
import { BadgeCheck } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { isOnShift } from "@/lib/shifts";
import { unitPrice, type Sale } from "@/lib/sales";

/**
 * One sale. A detailed row, not a card: this is a historical record people scan
 * down, comparing price and middleman between lines — cards are for browsable
 * inventory you pick from.
 *
 * Deliberately absent: buyer, seller, MM fee, and the buyer's total. The first
 * two are private to the deal room; the last two are deal-internal accounting
 * that says nothing about the market. The Discord last-sales channel shows
 * exactly this field set (docs/screenshots), and it is the right one.
 */
export function SaleRow({ sale }: { sale: Sale }) {
  const each = unitPrice(sale);

  return (
    <li className="px-4 py-4 transition-colors duration-200 hover:bg-raised sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 text-lead font-semibold tracking-tight text-ink">
          {sale.projectName}
        </h3>
        <time
          dateTime={sale.soldAt.toISOString()}
          className="shrink-0 font-mono tnum text-meta text-ink-faint"
        >
          {sale.soldAt.toISOString().slice(0, 10)}
        </time>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">{sale.chain}</Badge>
        <Badge tone={sale.specific === "GTD" ? "ok" : "warn"}>{sale.specific}</Badge>
      </div>

      {/* The figures, in the order the Discord embed lists them. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Figure label="Price for each" value={formatMoney(each, sale.asset)} />
        <Figure label="Quantity" value={sale.quantity.toLocaleString("en-US")} />
        <Figure
          label="Collateral"
          value={
            sale.collateralAmount && sale.collateralAmount > 0n
              ? formatMoney(sale.collateralAmount, sale.asset)
              : "None"
          }
          muted={!sale.collateralAmount || sale.collateralAmount <= 0n}
        />
        <div className="min-w-0">
          <dt className="text-meta text-ink-faint">Middleman</dt>
          <dd className="mt-1 flex min-w-0 items-center gap-2">
            {sale.middleman ? (
              <>
                <Avatar
                  name={sale.middleman.displayName ?? "??"}
                  seed={sale.middleman.id}
                  size="sm"
                  onShift={isOnShift(sale.middleman.workingHoursUtc)}
                />
                <span className="min-w-0 truncate font-mono text-body text-ink">
                  {sale.middleman.displayName ?? "unnamed"}
                </span>
                {sale.middleman.isVerifiedMm ? (
                  <BadgeCheck
                    aria-label="Verified middleman"
                    className="size-4 shrink-0 text-accent-text"
                    strokeWidth={2}
                  />
                ) : null}
              </>
            ) : (
              <span className="text-body text-ink-faint">unassigned</span>
            )}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function Figure({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-ink-faint">{label}</dt>
      <dd
        className={`mt-1 truncate font-mono tnum text-body ${
          muted ? "text-ink-faint" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
