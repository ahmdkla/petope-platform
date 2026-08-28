"use client";

import { useEffect, useRef, useState } from "react";
import { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * The bar itself. Purely presentational — it renders whenever `active` is true
 * and eases toward, but never reaches, 100%: a bar that completes before the
 * page does is a lie, and one that sits still reads as frozen.
 */
function Bar({ active }: { active: boolean }) {
  // Width and the phase it belongs to live together, so "active just changed"
  // is a comparison during render rather than a setState inside an effect.
  const [state, setState] = useState({ active, width: 0 });

  if (state.active !== active) {
    // Entering: jump to a visible sliver immediately, because the point of the
    // bar is that something happens on the click. Leaving: snap to full.
    setState({ active, width: active ? 8 : 100 });
  }

  useEffect(() => {
    if (!active) {
      // The completion is the signal, not the travel — hold full, then clear.
      const id = setTimeout(() => setState({ active: false, width: 0 }), 220);
      return () => clearTimeout(id);
    }
    // Decelerating creep: quick where perception is sharpest, then slower,
    // approaching ~90% however long the navigation takes. A bar that reaches
    // 100% before the page does is a lie; one that sits still reads as frozen.
    const id = setInterval(() => {
      setState((s) =>
        s.active && s.width < 90
          ? { ...s, width: s.width + Math.max(0.6, (90 - s.width) * 0.12) }
          : s,
      );
    }, 120);
    return () => clearInterval(id);
  }, [active]);

  if (state.width === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-busy={active}
      className="pointer-events-none fixed inset-x-0 top-0 z-200 h-0.5"
    >
      <div
        className="h-full bg-accent transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${state.width}%`, opacity: state.width === 100 ? 0 : 1 }}
      />
    </div>
  );
}

/**
 * Route progress, driven by `useLinkStatus` inside each navigating link.
 *
 * `useLinkStatus` reports pending from the moment the link is clicked, which is
 * the whole point: the bar has to appear on the click, not once the server
 * answers. A pathname-watching effect cannot do that — by the time the route
 * changes there is nothing left to wait for.
 */
export function LinkProgress() {
  const { pending } = useLinkStatus();
  return <Bar active={pending} />;
}

/**
 * Fallback for navigations that do not come from a `<Link>`: `router.push`
 * from the filter bar, the command palette, a claim that redirects. Those have
 * no link status to read, so this watches for the URL actually changing and
 * runs a short completion flourish. It cannot show early progress — only a
 * link can — but it keeps the two kinds of navigation looking the same.
 */
export function RouteChangeProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = `${pathname}?${params.toString()}`;
  const first = useRef(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 180);
    return () => clearTimeout(id);
  }, [key]);

  return <Bar active={visible} />;
}
