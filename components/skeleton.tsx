/**
 * Loading placeholders.
 *
 * These mirror the real layout closely enough that nothing jumps when the data
 * lands — the point is a page that fills in, not a spinner followed by a reflow.
 * `aria-hidden` throughout: the live region announcing "loading" belongs to the
 * container, and a screen reader gains nothing from a description of grey bars.
 */
export function Bar({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-md bg-raised ${className}`}
    />
  );
}

export function Tile({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 animate-pulse rounded-lg bg-raised ${className}`}
    />
  );
}

/** Wraps a skeleton region and announces it once, politely. */
export function Loading({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches `ListingCard`: header block, price block, footer with avatar. */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Bar className="h-5 w-40" />
          <Bar className="h-6 w-16" />
        </div>
        <div className="mt-3 flex gap-2">
          <Bar className="h-6 w-20" />
          <Bar className="h-6 w-16" />
          <Bar className="h-6 w-14" />
        </div>
        <Bar className="mt-5 h-8 w-32" />
        <div className="mt-4 space-y-2">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-4/5" />
          <Bar className="h-4 w-2/3" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Tile className="size-8" />
          <Bar className="h-4 w-24" />
        </div>
        <Bar className="h-field w-24" />
      </div>
    </div>
  );
}

/** Matches `DealList` in both of its shapes. */
export function DealListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      <ul className="space-y-3 xl:hidden">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="rounded-lg border border-line bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <Bar className="h-5 w-36" />
              <Bar className="h-6 w-24" />
            </div>
            <Bar className="mt-2.5 h-4 w-32" />
            <div className="mt-3 flex gap-4">
              <Bar className="h-4 w-16" />
              <Bar className="h-4 w-20" />
              <Bar className="ml-auto h-4 w-20" />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-lg border border-line bg-card shadow-card xl:block">
        <div className="h-12 border-b border-line bg-raised" />
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex h-row items-center gap-4 border-b border-line px-4 last:border-0"
          >
            <Bar className="h-4 w-32" />
            <Bar className="h-4 w-40" />
            <Bar className="h-6 w-24" />
            <Bar className="h-4 w-16" />
            <Bar className="h-4 w-24" />
            <Bar className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </>
  );
}

/** Matches a middleman roster card. */
export function MiddlemanCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-card">
      <div className="flex items-start gap-4">
        <Tile className="size-12" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="h-5 w-32" />
          <Bar className="h-4 w-24" />
        </div>
        <Bar className="h-6 w-20" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Bar className="h-14" />
        <Bar className="h-14" />
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
        <Bar className="h-4 w-36" />
        <Bar className="ml-auto h-6 w-24" />
      </div>
    </div>
  );
}

/** A stack of cards with a heading — the generic sidebar/section filler. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-card p-6 shadow-card">
      <Bar className="h-5 w-28" />
      {Array.from({ length: lines }, (_, i) => (
        <Bar key={i} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** A page that is a stack of cards: admin queues, support, reports. */
export function StackSkeleton({
  cards = 4,
  lines = 4,
}: {
  cards?: number;
  lines?: number;
}) {
  return (
    <div className="space-y-4">
      {Array.from({ length: cards }, (_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </div>
  );
}

/** Matches a `divide-y` list inside one bordered surface. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-card shadow-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <Tile className="size-10" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bar className="h-4 w-40" />
            <Bar className="h-4 w-56" />
          </div>
          <Bar className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Two-column article layout: FAQs, mints, report, vouches. */
export function ArticleSkeleton({
  blocks = 5,
  asideLines = 5,
}: {
  blocks?: number;
  asideLines?: number;
}) {
  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        {Array.from({ length: blocks }, (_, i) => (
          <div key={i} className="space-y-2.5">
            <Bar className="h-5 w-52" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-11/12" />
            <Bar className="h-4 w-3/4" />
          </div>
        ))}
      </div>
      <CardSkeleton lines={asideLines} />
    </div>
  );
}

/** Form pages: profile, new listing, settings. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-2xl space-y-5 rounded-lg border border-line bg-card p-6 shadow-card">
      <Bar className="h-5 w-40" />
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Bar className="h-4 w-28" />
          <Bar className="h-field w-full" />
        </div>
      ))}
      <Bar className="h-field w-32" />
    </div>
  );
}
