"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  ListingSide,
  ListingType,
  PaymentAsset,
  PriceType,
  SpotType,
} from "@prisma/client";
import { createListing } from "../actions";
import { Combobox } from "@/components/combobox";
import {
  Button,
  Card,
  FormError,
  Hint,
  Input,
  Label,
  Note,
  Caution,
  Select,
  SectionTitle,
} from "@/components/ui";
import {
  ASSET_LABEL,
  SETTLEMENT_ASSETS,
  formatMoney,
  parseAmount,
  resolveTotal,
} from "@/lib/money";
import {
  COMMON_CHAINS,
  FCFS_WARNING,
  LISTING_TYPE_EXPLAINER,
  LISTING_TYPE_LABEL,
} from "@/lib/listing-meta";

type Defaults = {
  side: ListingSide;
  chain: string;
  payment: PaymentAsset;
  specific: SpotType;
  type: ListingType;
};

// Only what terms can be agreed in. The exact stablecoin is settled later.
const ASSETS = SETTLEMENT_ASSETS;

export const DRAFT_KEY = "exsaverse-listing-draft";

export type ListingDraft = {
  side: ListingSide;
  item: string;
  chain: string;
  price: string;
  priceType: PriceType;
  payment: PaymentAsset;
  specific: SpotType;
  type: ListingType;
  quantity: string;
  collateral: string;
  projectLink: string;
  acceptsOffers: boolean;
};

function readDraft(): ListingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ListingDraft) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private browsing; nothing was stored to clear.
  }
  window.dispatchEvent(new Event(DRAFT_KEY));
}

export function ListingForm({
  knownChains,
  defaults,
  onDone,
}: {
  knownChains: string[];
  defaults: Defaults | null;
  /** Called after a successful post, so a modal host can close itself. */
  onDone?: () => void;
}) {
  // Read once, synchronously, so the first render already has the draft —
  // no setState-in-effect, no flash of empty fields.
  const [restored] = useState(() => (typeof window === "undefined" ? null : readDraft()));
  const [draftRestored, setDraftRestored] = useState(Boolean(restored));
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [side, setSide] = useState<ListingSide>(restored?.side ?? defaults?.side ?? "SELL");
  const [item, setItem] = useState(restored?.item ?? "");
  const [chain, setChain] = useState(restored?.chain ?? defaults?.chain ?? "Solana");
  const [price, setPrice] = useState(restored?.price ?? "");
  const [priceType, setPriceType] = useState<PriceType>(restored?.priceType ?? "FOR_EACH");
  const [payment, setPayment] = useState<PaymentAsset>(restored?.payment ?? defaults?.payment ?? "STABLE");
  const [specific, setSpecific] = useState<SpotType>(restored?.specific ?? defaults?.specific ?? "GTD");
  const [type, setType] = useState<ListingType>(restored?.type ?? defaults?.type ?? "ANY");
  const [quantity, setQuantity] = useState(restored?.quantity ?? "1");
  const [collateral, setCollateral] = useState(restored?.collateral ?? "");
  const [projectLink, setProjectLink] = useState(restored?.projectLink ?? "");
  const [acceptsOffers, setAcceptsOffers] = useState(restored?.acceptsOffers ?? false);

  // Persist on change so an accidental close loses nothing. Written on every
  // keystroke rather than on an interval: the whole point is surviving a close
  // the user did not plan.
  useEffect(() => {
    const draft: ListingDraft = {
      side, item, chain, price, priceType, payment, specific, type,
      quantity, collateral, projectLink, acceptsOffers,
    };
    const empty = !item.trim() && !price.trim() && !collateral.trim() && !projectLink.trim();
    try {
      if (empty) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Private browsing: the form still works, it just will not survive a close.
    }
    window.dispatchEvent(new Event(DRAFT_KEY));
  }, [side, item, chain, price, priceType, payment, specific, type, quantity, collateral, projectLink, acceptsOffers]);

  const chainOptions = useMemo(
    () => Array.from(new Set([...COMMON_CHAINS, ...knownChains])).sort(),
    [knownChains],
  );

  // Live resolved total: "3 for $15 for all" vs "for each" is a 3x difference.
  const total = useMemo(() => {
    const p = parseAmount(price, payment);
    const q = Number(quantity);
    if (p === null || !Number.isFinite(q) || q < 1) return null;
    return resolveTotal(p, priceType, Math.floor(q));
  }, [price, payment, priceType, quantity]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedPrice = parseAmount(price, payment);
    if (parsedPrice === null || parsedPrice <= 0n) {
      setError(`Enter a price in ${ASSET_LABEL[payment]}.`);
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError("Quantity must be a whole number of 1 or more.");
      return;
    }
    const parsedCollateral =
      collateral.trim() === "" ? null : parseAmount(collateral, payment);
    if (collateral.trim() !== "" && parsedCollateral === null) {
      setError(`Collateral must be an amount in ${ASSET_LABEL[payment]}.`);
      return;
    }

    startTransition(async () => {
      const res = await createListing({
        side,
        item: item.trim(),
        chain: chain.trim(),
        price: parsedPrice,
        priceType,
        payment,
        specific,
        type,
        quantity: qty,
        collateral: parsedCollateral,
        projectLink: projectLink.trim() === "" ? null : projectLink.trim(),
        acceptsOffers,
      });
      if (!res.ok) setError(res.error);
      else {
        clearDraft();
        if (onDone) {
          onDone();
          router.refresh();
        } else {
          router.push(`/listings?side=${side}`);
        }
      }
    });
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      {draftRestored ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/25 bg-warn-soft p-4">
          <p className="text-body text-warn">
            Unsaved draft restored from the last time you started this.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              clearDraft();
              setDraftRestored(false);
              setItem("");
              setPrice("");
              setCollateral("");
              setProjectLink("");
              setQuantity("1");
              setAcceptsOffers(false);
            }}
          >
            Discard draft
          </Button>
        </div>
      ) : null}
      {/* One form, one model, a side toggle. Not two flows. */}
      <Card className="space-y-4">
        <fieldset className="space-y-1.5">
          <legend className="mb-2 text-meta font-medium text-ink-muted">
            Listing side
          </legend>
          <div className="inline-flex rounded-md border border-line bg-raised p-1">
            {(["SELL", "BUY"] as ListingSide[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                aria-pressed={side === s}
                className={`h-11 cursor-pointer rounded-md px-4 text-body font-medium transition-colors duration-200 ${
                  side === s
                    ? s === "SELL"
                      ? "bg-sell-soft text-sell"
                      : "bg-buy-soft text-buy"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {s === "SELL" ? "I am selling" : "I am buying"}
              </button>
            ))}
          </div>
          <Hint>
            {side === "SELL"
              ? "Your listing appears in the Selling feed for buyers to browse."
              : "Your request appears in the Buying feed for sellers to fill."}
          </Hint>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="item">
              Project <Req />
            </Label>
            <Input
              id="item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              required
              maxLength={120}
              placeholder="Project or item name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chain">
              Project chain <Req />
            </Label>
            <Combobox
              id="chain"
              value={chain}
              onChange={setChain}
              options={chainOptions}
              required
              maxLength={60}
              placeholder="Solana, Base, Ethereum..."
            />
            <Hint>
              The network the project mints on. Not how you get paid — new chains
              appear constantly, so type any value.
            </Hint>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>Price</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="price">
              Price <Req />
            </Label>
            <Input
              id="price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priceType">
              Per <Req />
            </Label>
            <Select
              id="priceType"
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as PriceType)}
            >
              <option value="FOR_EACH">For each</option>
              <option value="FOR_ALL">For all</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment">
              Settlement asset <Req />
            </Label>
            <Select
              id="payment"
              value={payment}
              onChange={(e) => setPayment(e.target.value as PaymentAsset)}
            >
              {ASSETS.map((a) => (
                <option key={a} value={a}>
                  {ASSET_LABEL[a]}
                </option>
              ))}
            </Select>
            <Hint>
              {payment === "STABLE"
                ? "USDC and USDT are interchangeable. The buyer sends either; which one is recorded when the payment lands."
                : "Settled in SOL."}{" "}
              Always on Solana, whatever the project chain is.
            </Hint>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collateral">Collateral</Label>
            <Input
              id="collateral"
              inputMode="decimal"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="None"
            />
            <Hint>
              What the seller locks up as insurance. Leave blank for none; a
              minimum may be enforced for the method agreed in the ticket.
            </Hint>
          </div>
        </div>

        {/* Resolved total, live. The most misreadable field on a listing. */}
        <div className="flex items-baseline justify-between rounded-lg border border-accent-line bg-accent-soft px-4 py-4">
          <span className="text-body text-ink-muted">
            Total for {quantity || "1"}{" "}
            {Number(quantity) === 1 ? "spot" : "spots"}
          </span>
          <span className="font-mono tnum text-title font-bold text-ink">
            {total === null ? "—" : formatMoney(total, payment)}
          </span>
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>Terms</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="specific">
              Spot type <Req />
            </Label>
            <Select
              id="specific"
              value={specific}
              onChange={(e) => setSpecific(e.target.value as SpotType)}
            >
              <option value="GTD">GTD — guaranteed</option>
              <option value="FCFS">FCFS — first come, first served</option>
            </Select>
            {specific === "FCFS" ? <Caution>{FCFS_WARNING}</Caution> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">
              Method <Req />
            </Label>
            <Select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as ListingType)}
            >
              {(Object.keys(LISTING_TYPE_LABEL) as ListingType[]).map((t) => (
                <option key={t} value={t}>
                  {LISTING_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            {/* Explaining the method inline: most disputes trace back to
                someone not understanding what they agreed to. */}
            <Note>{LISTING_TYPE_EXPLAINER[type]}</Note>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="projectLink">Project link</Label>
          <Input
            id="projectLink"
            type="url"
            value={projectLink}
            onChange={(e) => setProjectLink(e.target.value)}
            placeholder="https://x.com/..."
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-body text-ink-muted">
          <input
            type="checkbox"
            checked={acceptsOffers}
            onChange={(e) => setAcceptsOffers(e.target.checked)}
            className="mt-1 size-4 cursor-pointer rounded-md border-line bg-raised accent-accent"
          />
          <span>
            Accept offers.{" "}
            {side === "SELL"
              ? "Buyers can propose a higher or lower price."
              : "Sellers can propose a price."}
          </span>
        </label>
      </Card>

      <FormError message={error} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Posting" : "Post listing"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => (onDone ? onDone() : router.back())}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Req() {
  return (
    <span aria-hidden className="text-danger">
      *
    </span>
  );
}
