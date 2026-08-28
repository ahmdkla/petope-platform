"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

/**
 * The sidebar as a slide-in drawer below `md`.
 *
 * The same <Sidebar> renders in both places — one definition of the navigation,
 * two containers. Closing on route change matters: without it the drawer stays
 * over the page the user just asked for.
 */
export function MobileNav({
  showQueue,
  showAdmin,
}: {
  showQueue: boolean;
  showAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shownFor, setShownFor] = useState(pathname);

  // A drawer that outlives its navigation is a trap on a phone. Links close it
  // themselves via `onNavigate`; this catches the back button, which changes the
  // route without any click of ours. Adjusting during render rather than in an
  // effect means the drawer is never painted over the new page.
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    // Stop the page behind scrolling under the drawer.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-card text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink md:hidden"
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-100 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/60"
          />
          <div className="relative flex h-full w-60 max-w-[85vw]">
            <Sidebar
              showQueue={showQueue}
              showAdmin={showAdmin}
              onNavigate={() => setOpen(false)}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute -right-14 top-3 grid size-11 cursor-pointer place-items-center rounded-md border border-line bg-card text-ink-muted"
            >
              <X aria-hidden className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
