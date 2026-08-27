"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ListingSide, ListingStatus, PaymentAsset } from "@prisma/client";
import { quickDeal, delistListing, makeOffer } from "./actions";
import { Button, Input, Label, Textarea, FormError, Hint } from "@/components/ui";
import { parseAmount } from "@/lib/money";
import { Modal } from "@/components/modal";

export function ListingActions({
  listingId,
  side,
  isOwner,
  signedIn,
  acceptsOffers,
  status,
  asset,
  quantityRemaining,
  priceType,
  oversubscribed,
}: {
  listingId: string;
  side: ListingSide;
  isOwner: boolean;
  signedIn: boolean;
  acceptsOffers: boolean;
  status: ListingStatus;
  asset: PaymentAsset;
  quantityRemaining: number;
  priceType: "FOR_EACH" | "FOR_ALL";
  oversubscribed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [confirmDelist, setConfirmDelist] = useState(false);

  const unavailable = status !== "ACTIVE" || quantityRemaining < 1;
  const [spotsOpen, setSpotsOpen] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && !res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? (
        <span role="alert" className="text-meta text-danger">
          {error}
        </span>
      ) : null}

      {isOwner ? (
        <Button
          size="sm"
          variant="danger"
          disabled={pending || status === "SOLD_OUT"}
          onClick={() => setConfirmDelist(true)}
          title={status === "SOLD_OUT" ? "This listing is sold out" : undefined}
        >
          Delist
        </Button>
      ) : (
        <>
          {acceptsOffers && !unavailable ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !signedIn}
              onClick={() => setOfferOpen(true)}
            >
              Offer
            </Button>
          ) : null}

          <Button
            size="sm"
            disabled={pending || unavailable || !signedIn}
            onClick={() =>
              // A for-all listing cannot be split, and a single remaining spot
              // needs no choosing — skip straight to the deal in both cases.
              priceType === "FOR_ALL" || quantityRemaining === 1
                ? run(() => quickDeal(listingId, quantityRemaining))
                : setSpotsOpen(true)
            }
          >
            {status === "SOLD_OUT"
              ? "Sold out"
              : side === "SELL"
                ? "Quick Buy"
                : "Quick Sell"}
          </Button>
        </>
      )}

      {confirmDelist ? (
        <Modal
          title="Delist this listing?"
          onClose={() => setConfirmDelist(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelist(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const r = await delistListing(listingId);
                    if (r.ok) setConfirmDelist(false);
                    return r;
                  })
                }
              >
                {pending ? "Delisting" : "Delist"}
              </Button>
            </>
          }
        >
          <p className="text-body text-ink-muted">
            The listing stops appearing in the feed. Existing deals opened from it
            are unaffected.
          </p>
        </Modal>
      ) : null}

      {spotsOpen ? (
        <SpotsDialog
          listingId={listingId}
          max={quantityRemaining}
          oversubscribed={oversubscribed}
          onClose={() => setSpotsOpen(false)}
        />
      ) : null}

      {offerOpen ? (
        <OfferDialog
          listingId={listingId}
          asset={asset}
          onClose={() => setOfferOpen(false)}
          onDone={() => {
            setOfferOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function OfferDialog({
  listingId,
  asset,
  onClose,
  onDone,
}: {
  listingId: string;
  asset: PaymentAsset;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAmount(amount, asset);
    if (parsed === null || parsed <= 0n) {
      setError(`Enter an amount in ${asset}.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await makeOffer({
        listingId,
        amount: parsed,
        message: message.trim() || null,
      });
      if (!res.ok) setError(res.error);
      else onDone();
    });
  }

  return (
    <Modal
      title="Make an offer"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="offer-form" type="submit" disabled={pending}>
            {pending ? "Sending" : "Send offer"}
          </Button>
        </>
      }
    >
      <form id="offer-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="offer-amount">Your offer</Label>
          <div className="flex items-center gap-2">
            <Input
              id="offer-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <span className="font-mono text-body text-ink-muted">{asset}</span>
          </div>
          <Hint>Settled in {asset} on Solana, regardless of the project chain.</Hint>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="offer-message">Message (optional)</Label>
          <Textarea
            id="offer-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
          />
        </div>

        <FormError message={error} />
      </form>
    </Modal>
  );
}

/**
 * Choosing how many spots to take. Only shown for for-each listings with more
 * than one spot left — a for-all price cannot be split.
 */
function SpotsDialog({
  listingId,
  max,
  oversubscribed,
  onClose,
}: {
  listingId: string;
  max: number;
  oversubscribed: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [spots, setSpots] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await quickDeal(listingId, spots);
      if (res && !res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Modal
      title="How many spots?"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="spots-form" type="submit" disabled={pending}>
            {pending ? "Opening deal" : "Open deal"}
          </Button>
        </>
      }
    >
      <form id="spots-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="spots">Spots</Label>
          <Input
            id="spots"
            type="number"
            min={1}
            max={max}
            value={spots}
            onChange={(e) => setSpots(Math.max(1, Math.min(max, Number(e.target.value) || 1)))}
            autoFocus
          />
          <Hint>{max} available. You can take some or all of them.</Hint>
        </div>

        {oversubscribed ? (
          <p className="rounded-md border border-warn/25 bg-warn-soft px-3 py-2.5 text-meta text-warn">
            More spots are already claimed by open deals than this listing has
            left. Spots are only reserved when a deal is funded, so whoever pays
            first gets them.
          </p>
        ) : null}

        <FormError message={error} />
      </form>
    </Modal>
  );
}
