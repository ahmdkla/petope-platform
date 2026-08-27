"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDashed } from "lucide-react";
import type { Deal } from "@prisma/client";
import { setMethodConfirmation, proposeTerms } from "./actions";
import {
  Button,
  Card,
  FormError,
  Hint,
  Input,
  Label,
  Note,
  SectionTitle,
  Select,
} from "@/components/ui";
import { DEAL_METHOD_RULES, SELECTABLE_METHODS } from "@/lib/deal-methods";
import { parseAmount, formatAmount, formatMoney } from "@/lib/money";
import { computeMmFee, type MmFeeConfig } from "@/lib/mm-fee";
import type { ActorRole } from "@/lib/deal-transitions";

/**
 * The escrow method must be explicitly confirmed by BOTH parties before terms
 * can be locked, regardless of what the listing said. Changing the proposal
 * resets both confirmations.
 */
export function MethodConfirmation({
  deal,
  role,
  feeConfig,
}: {
  deal: Deal;
  role: ActorRole;
  feeConfig: MmFeeConfig;
}) {
  const isParty = role === "BUYER" || role === "SELLER";
  const isMm = role === "MIDDLEMAN" || role === "ADMIN";

  return (
    <Card className="space-y-5">
      <SectionTitle>Escrow method</SectionTitle>

      {deal.method ? (
        <ConfirmationState deal={deal} role={role} isParty={isParty} />
      ) : (
        <Note>
          The middleman has not proposed a method yet. Nothing can be locked or
          paid until both parties agree on one.
        </Note>
      )}

      {isMm ? <ProposeTerms deal={deal} feeConfig={feeConfig} /> : null}
    </Card>
  );
}

function ConfirmationState({
  deal,
  role,
  isParty,
}: {
  deal: Deal;
  role: ActorRole;
  isParty: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rule = deal.method ? DEAL_METHOD_RULES[deal.method] : null;
  const mine =
    role === "BUYER"
      ? deal.methodConfirmedByBuyerAt
      : role === "SELLER"
        ? deal.methodConfirmedBySellerAt
        : null;

  function setConfirmed(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setMethodConfirmation(deal.id, next);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-ink-muted">{rule?.summary}</p>

      <ul className="space-y-2">
        <ConfirmRow label="Buyer" at={deal.methodConfirmedByBuyerAt} />
        <ConfirmRow label="Seller" at={deal.methodConfirmedBySellerAt} />
      </ul>

      {isParty ? (
        <div className="space-y-2 border-t border-line pt-4">
          {mine ? (
            <>
              <p className="text-meta text-ok">You confirmed this method.</p>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmed(false)}
              >
                Withdraw confirmation
              </Button>
            </>
          ) : (
            <>
              <p className="text-body text-ink-muted">
                Read the method notes in the terms card above, then confirm that
                this is the flow you are agreeing to.
              </p>
              <Button disabled={pending} onClick={() => setConfirmed(true)}>
                {pending ? "Confirming" : "Confirm this method"}
              </Button>
            </>
          )}
          <FormError message={error} />
        </div>
      ) : null}
    </div>
  );
}

function ConfirmRow({ label, at }: { label: string; at: Date | null }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-raised px-3 py-2.5">
      <span className="flex items-center gap-2 text-body text-ink">
        {at ? (
          <Check aria-hidden className="size-4 text-ok" strokeWidth={2.5} />
        ) : (
          <CircleDashed aria-hidden className="size-4 text-ink-faint" strokeWidth={2} />
        )}
        {label}
      </span>
      <span className="font-mono text-meta text-ink-faint">
        {at ? at.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "not confirmed"}
      </span>
    </li>
  );
}

/** Middleman-only: propose the method and the money terms that go with it. */
function ProposeTerms({
  deal,
  feeConfig,
}: {
  deal: Deal;
  feeConfig: MmFeeConfig;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!deal.method);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [method, setMethod] = useState(deal.method ?? SELECTABLE_METHODS[0].id);
  const [collateral, setCollateral] = useState(
    deal.collateralAmount ? formatAmount(deal.collateralAmount, deal.asset) : "",
  );
  const [mintPrice, setMintPrice] = useState(
    deal.mintPrice ? formatAmount(deal.mintPrice, deal.asset) : "",
  );
  const [mintAt, setMintAt] = useState(
    deal.mintAt ? deal.mintAt.toISOString().slice(0, 16) : "",
  );

  const rule = DEAL_METHOD_RULES[method];
  const changing = deal.method !== null && deal.method !== method;

  /**
   * Preview only. The server recomputes this from the same config on write —
   * a fee is never accepted from the client, so nothing here is authoritative.
   */
  const preview = computeMmFee(
    {
      dealAmount: deal.dealAmount,
      collateral: collateral.trim() === "" ? null : parseAmount(collateral, deal.asset),
      asset: deal.asset,
    },
    feeConfig,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const col = collateral.trim() === "" ? null : parseAmount(collateral, deal.asset);
    if (collateral.trim() !== "" && col === null) {
      setError(`Collateral must be an amount in ${deal.asset}.`);
      return;
    }
    const mp = mintPrice.trim() === "" ? null : parseAmount(mintPrice, deal.asset);
    if (mintPrice.trim() !== "" && mp === null) {
      setError(`Mint price must be an amount in ${deal.asset}.`);
      return;
    }

    startTransition(async () => {
      const res = await proposeTerms(deal.id, {
        method,
        collateralAmount: col,
        mintPrice: mp,
        mintAt: mintAt ? new Date(mintAt) : null,
      });
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <div className="border-t border-line pt-4">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Change terms
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-line pt-5">
      <div className="space-y-1.5">
        <Label htmlFor="method">Escrow method</Label>
        <Select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
        >
          {SELECTABLE_METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
        <Hint>{rule.summary}</Hint>
      </div>

      {changing ? (
        <Note>
          Changing the method clears both confirmations. The buyer and seller
          will each have to confirm the new flow.
        </Note>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="collateral">Collateral ({deal.asset})</Label>
          <Input
            id="collateral"
            inputMode="decimal"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            placeholder={rule.requiresCollateral ? "required" : "not required"}
          />
          <Hint>
            {rule.requiresCollateral
              ? `Required for ${rule.label}. Formula: ${rule.collateralFormula.replace(/_/g, " ")}.`
              : `${rule.label} does not use collateral.`}
          </Hint>
        </div>

        {/* Read-only: the fee is computed server-side and never accepted from
            a client. This mirrors the calculation so the middleman can see the
            effect of the collateral they are setting. */}
        <div className="space-y-1.5">
          <Label htmlFor="fee-preview">MM fee ({deal.asset})</Label>
          <output
            id="fee-preview"
            className="flex h-field items-center rounded-md border border-line bg-card px-3 font-mono tnum text-body text-ink"
          >
            {formatMoney(preview.fee, deal.asset)}
          </output>
          <Hint>
            {preview.atFloor
              ? `Minimum fee for ${deal.asset}. ${feeConfig.percentBasisPoints / 100}% of ${formatMoney(preview.base, deal.asset)} would be lower.`
              : `${feeConfig.percentBasisPoints / 100}% of ${formatMoney(preview.base, deal.asset)} (deal amount plus collateral). Paid by the buyer on top.`}
          </Hint>
        </div>

        {rule.buyerPays.includes("mint_price") ? (
          <div className="space-y-1.5">
            <Label htmlFor="mintPrice">Mint price ({deal.asset})</Label>
            <Input
              id="mintPrice"
              inputMode="decimal"
              value={mintPrice}
              onChange={(e) => setMintPrice(e.target.value)}
              required
            />
            <Hint>On {rule.label} the buyer also funds the mint.</Hint>
          </div>
        ) : null}

        {rule.requiresMintEvent ? (
          <div className="space-y-1.5">
            <Label htmlFor="mintAt">Mint date and time (UTC)</Label>
            <Input
              id="mintAt"
              type="datetime-local"
              value={mintAt}
              onChange={(e) => setMintAt(e.target.value)}
              required
            />
            <Hint>Drives the release timers. It can be changed if the project delays.</Hint>
          </div>
        ) : null}
      </div>

      <FormError message={error} />

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : deal.method ? "Update terms" : "Propose terms"}
        </Button>
        {deal.method ? (
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
