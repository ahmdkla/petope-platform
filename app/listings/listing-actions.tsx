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
}: {
  listingId: string;
  side: ListingSide;
  isOwner: boolean;
  signedIn: boolean;
  acceptsOffers: boolean;
  status: ListingStatus;
  asset: PaymentAsset;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [confirmDelist, setConfirmDelist] = useState(false);

  const unavailable = status !== "ACTIVE";

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
          disabled={pending || status === "IN_DEAL"}
          onClick={() => setConfirmDelist(true)}
          title={status === "IN_DEAL" ? "This listing has an open deal" : undefined}
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
            onClick={() => run(() => quickDeal(listingId))}
          >
            {side === "SELL" ? "Quick Buy" : "Quick Sell"}
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
