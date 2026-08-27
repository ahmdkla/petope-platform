"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ListingSide } from "@prisma/client";

/** BUY and SELL are two feeds of the same model, not two separate pages. */
export function SideTabs({
  side,
  buyCount,
  sellCount,
}: {
  side: ListingSide;
  buyCount: number;
  sellCount: number;
}) {
  const params = useSearchParams();

  function href(next: ListingSide) {
    const p = new URLSearchParams(params.toString());
    p.set("side", next);
    return `/listings?${p.toString()}`;
  }

  const tabs: { value: ListingSide; label: string; count: number }[] = [
    { value: "SELL", label: "Selling", count: sellCount },
    { value: "BUY", label: "Buying", count: buyCount },
  ];

  return (
    <div role="tablist" aria-label="Listing side" className="-mb-px flex gap-1">
      {tabs.map((t) => {
        const active = side === t.value;
        return (
          <Link
            key={t.value}
            role="tab"
            aria-selected={active}
            href={href(t.value)}
            className={`flex h-12 items-center gap-2 border-b-2 px-4 text-body transition-colors duration-200 ${
              active
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono tnum text-meta ${
                active ? "bg-accent-soft text-accent-text" : "bg-raised text-ink-faint"
              }`}
            >
              {t.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
