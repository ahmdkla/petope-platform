"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Modal } from "@/components/modal";
import { Button, SectionTitle } from "@/components/ui";
import { ListingFilters } from "./listing-filters";

/**
 * The filters, in a persistent left rail on desktop and behind a button on
 * mobile — the pattern OpenSea and Magic Eden use, and for the same reason: a
 * marketplace is browsed by narrowing, so the controls that narrow it should be
 * permanently in view rather than a row you scroll past.
 *
 * Below `lg` there is no room for a rail without halving the grid, so it
 * becomes a sheet. `Modal` already renders as a bottom sheet on small screens.
 *
 * Nothing about the filtering changes: state stays in the URL either way, so a
 * filtered view is still shareable and still survives back navigation.
 */
export function FilterPanel({ chains }: { chains: string[] }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();

  const activeCount = ["chain", "type", "specific", "q"].filter((k) =>
    params.get(k),
  ).length;

  return (
    <>
      {/* Mobile: a button that reports how many filters are on, so their
          existence is visible without opening the sheet. */}
      <div className="lg:hidden">
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto"
        >
          <SlidersHorizontal aria-hidden className="size-4" strokeWidth={2} />
          Filters
          {activeCount > 0 ? (
            <span className="rounded-md bg-accent px-1.5 py-0.5 font-mono tnum text-meta font-bold text-accent-ink">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </div>

      {open ? (
        <Modal title="Filters" onClose={() => setOpen(false)}>
          <ListingFilters chains={chains} />
        </Modal>
      ) : null}

      {/* Desktop: the rail. Sticky so it stays with you down a long feed. */}
      <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
        <SectionTitle className="mb-4">Filters</SectionTitle>
        <ListingFilters chains={chains} />
      </aside>
    </>
  );
}
