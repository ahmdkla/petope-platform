"use client";

import { useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import { ListingForm, type ListingDraft, DRAFT_KEY } from "./new/listing-form";
import type { ListingSide, ListingType, PaymentAsset, SpotType } from "@prisma/client";

export type FormDefaults = {
  side: ListingSide;
  chain: string;
  payment: PaymentAsset;
  specific: SpotType;
  type: ListingType;
} | null;

/**
 * Posting a listing is a dialog opened from the marketplace, so the feed stays
 * behind it. /listings/new remains a real route for direct links and for
 * anyone who opens it in a new tab.
 */
export function NewListingButton({
  knownChains,
  defaults,
}: {
  knownChains: string[];
  defaults: FormDefaults;
}) {
  const [open, setOpen] = useState(false);
  // localStorage is the store; reading it through useSyncExternalStore avoids
  // a setState-in-effect and keeps server and client renders consistent.
  const hasDraft = useSyncExternalStore(subscribeDraft, readHasDraft, () => false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-field cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-body font-medium text-accent-ink transition-all duration-200 hover:brightness-110"
      >
        <Plus aria-hidden className="size-[18px]" strokeWidth={2.25} />
        Post a listing
        {hasDraft ? (
          <span
            aria-label="You have an unsaved draft"
            className="absolute -right-1 -top-1 size-2.5 rounded-md bg-warn"
          />
        ) : null}
      </button>

      {open ? (
        <Modal title="Post a listing" onClose={() => setOpen(false)} size="lg">
          <ListingForm
            knownChains={knownChains}
            defaults={defaults}
            onDone={() => setOpen(false)}
          />
        </Modal>
      ) : null}
    </>
  );
}

function subscribeDraft(cb: () => void) {
  window.addEventListener(DRAFT_KEY, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(DRAFT_KEY, cb);
    window.removeEventListener("storage", cb);
  };
}

function readHasDraft(): boolean {
  try {
    return Boolean(localStorage.getItem(DRAFT_KEY));
  } catch {
    return false;
  }
}

export type { ListingDraft };
