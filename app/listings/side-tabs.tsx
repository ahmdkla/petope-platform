"use client";

import Link, { useLinkStatus } from "next/link";
import { useSearchParams } from "next/navigation";
import { Store, Handshake } from "lucide-react";
import type { ListingSide } from "@prisma/client";
import { LinkProgress } from "@/components/shell/route-progress";

/**
 * BUY and SELL are two entirely different markets, and this is the control that
 * moves between them — so it is built as a segmented control with a filled
 * active segment, not two text links that happen to be near each other.
 *
 * Weight comes from the raised track, the elevated active segment and the
 * BUY/SELL semantic colours, all of which the Design Direction already uses to
 * distinguish the two sides. No gradient anywhere: the fill is flat.
 *
 * State lives in the URL, so this stays a pair of links rather than buttons —
 * shareable, back/forward-able, and prefetched.
 */
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

  const segments = [
    { value: "SELL" as const, label: "Selling", sub: "Spots for sale", icon: Store, count: sellCount },
    { value: "BUY" as const, label: "Buying", sub: "Buyers looking", icon: Handshake, count: buyCount },
  ];

  return (
    <nav
      aria-label="Market side"
      className="flex w-full max-w-xl gap-1.5 rounded-xl border border-line bg-raised p-1.5"
    >
      {segments.map((s) => (
        <Link
          key={s.value}
          href={href(s.value)}
          // Without this the browser jumps to the top of the document on every
          // switch, which on a long feed loses the reader's place.
          scroll={false}
          aria-current={side === s.value ? "page" : undefined}
          className="min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <Segment
            label={s.label}
            sub={s.sub}
            count={s.count}
            side={s.value}
            active={side === s.value}
            Icon={s.icon}
          />
        </Link>
      ))}
    </nav>
  );
}

/**
 * Must be a child of `<Link>`: `useLinkStatus` only reports from inside one,
 * and it is what drives both the top progress bar and the instant active swap
 * on click — so the segment you pressed fills immediately rather than when the
 * server answers.
 */
function Segment({
  label,
  sub,
  count,
  side,
  active,
  Icon,
}: {
  label: string;
  sub: string;
  count: number;
  side: ListingSide;
  active: boolean;
  Icon: typeof Store;
}) {
  const { pending } = useLinkStatus();
  const on = active || pending;

  // BUY and SELL keep their own colours, so which market you are in is legible
  // from the fill alone, before reading a word of it.
  const tone =
    side === "SELL"
      ? "border-sell/40 bg-sell-soft text-sell"
      : "border-buy/40 bg-buy-soft text-buy";

  return (
    <>
      <span
        className={`flex h-full items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200 sm:px-4 ${
          on
            ? `${tone} shadow-card`
            : "border-transparent text-ink-muted hover:bg-card hover:text-ink"
        }`}
      >
        <Icon
          aria-hidden
          className={`size-5 shrink-0 ${on ? "" : "text-ink-faint"}`}
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-body font-semibold">{label}</span>
          <span
            className={`hidden truncate text-meta sm:block ${
              on ? "opacity-80" : "text-ink-faint"
            }`}
          >
            {sub}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 font-mono tnum text-meta font-semibold ${
            on ? "bg-card/70" : "bg-card text-ink-faint"
          }`}
        >
          {count}
        </span>
      </span>
      <LinkProgress />
    </>
  );
}
