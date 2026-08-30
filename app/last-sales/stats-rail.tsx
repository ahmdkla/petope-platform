import { Card, SectionTitle } from "@/components/ui";
import { TrendingUp, CalendarClock, Receipt, ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { SalesStats } from "@/lib/sales";

/**
 * Market figures beside the feed. Sticky from `lg` up, for the same reason the
 * FAQ aside is: they are reference while you read down a long list, and
 * `self-start` is what stops the grid item stretching to the row height and
 * leaving nothing to stick against.
 */
export function StatsRail({ stats }: { stats: SalesStats }) {
  return (
    <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
      <Card className="space-y-4">
        <SectionTitle>Market</SectionTitle>

        <div>
          <p className="flex items-center gap-1.5 text-meta text-ink-faint">
            <TrendingUp aria-hidden className="size-3.5" strokeWidth={2} />
            Volume secured
          </p>
          {stats.volume.length === 0 ? (
            <p className="mt-1 text-body text-ink-faint">Nothing yet</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {/* One line per asset. SOL and stablecoins are not added together:
                  there is no price feed on this platform, so a combined total
                  would be an invented number. */}
              {stats.volume.map((v) => (
                <li
                  key={v.asset}
                  className="font-mono tnum text-section font-semibold text-ink"
                >
                  {formatMoney(v.total, v.asset)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
          <Figure
            icon={Receipt}
            label={stats.capped ? "Sales (recent)" : "Total sales"}
            value={stats.totalSales.toLocaleString("en-US")}
          />
          <Figure
            icon={CalendarClock}
            label="Last 7 days"
            value={stats.lastSevenDays.toLocaleString("en-US")}
          />
        </div>

        {stats.topMiddleman ? (
          <div className="border-t border-line pt-4">
            <p className="flex items-center gap-1.5 text-meta text-ink-faint">
              <ShieldCheck aria-hidden className="size-3.5" strokeWidth={2} />
              Most active middleman
            </p>
            <p className="mt-1 font-mono text-lead font-semibold text-ink">
              {stats.topMiddleman.name}
            </p>
            <p className="text-meta text-ink-muted">
              {stats.topMiddleman.sales}{" "}
              {stats.topMiddleman.sales === 1 ? "sale" : "sales"} secured
            </p>
          </div>
        ) : null}

        {stats.capped ? (
          <p className="border-t border-line pt-4 text-meta text-ink-faint">
            Figures cover the most recent sales loaded, not all history.
          </p>
        ) : null}
      </Card>
    </aside>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-meta text-ink-faint">
        <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 font-mono tnum text-section font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}
