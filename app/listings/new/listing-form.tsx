"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  ListingSide,
  ListingType,
  PaymentAsset,
  PriceType,
  SpotType,
} from "@prisma/client";
import { createListing } from "../actions";
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
import { formatMoney, parseAmount, resolveTotal } from "@/lib/money";
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

const ASSETS: PaymentAsset[] = ["SOL", "USDC", "USDT"];

export function ListingForm({
  knownChains,
  defaults,
}: {
  knownChains: string[];
  defaults: Defaults | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [side, setSide] = useState<ListingSide>(defaults?.side ?? "SELL");
  const [item, setItem] = useState("");
  const [chain, setChain] = useState(defaults?.chain ?? "Solana");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("FOR_EACH");
  const [payment, setPayment] = useState<PaymentAsset>(defaults?.payment ?? "USDC");
  const [specific, setSpecific] = useState<SpotType>(defaults?.specific ?? "GTD");
  const [type, setType] = useState<ListingType>(defaults?.type ?? "ANY");
  const [quantity, setQuantity] = useState("1");
  const [collateral, setCollateral] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [acceptsOffers, setAcceptsOffers] = useState(false);

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
      setError(`Enter a price in ${payment}.`);
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
      setError(`Collateral must be an amount in ${payment}.`);
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
      else router.push(`/listings?side=${side}`);
    });
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
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
                className={`h-10 cursor-pointer rounded-md px-4 text-body font-medium transition-colors duration-200 ${
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
            <Input
              id="chain"
              list="chain-options"
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              required
              maxLength={60}
            />
            <datalist id="chain-options">
              {chainOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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
                  {a}
                </option>
              ))}
            </Select>
            <Hint>Always settled on Solana, whatever the project chain is.</Hint>
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
        <Button type="button" variant="secondary" onClick={() => router.back()}>
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
