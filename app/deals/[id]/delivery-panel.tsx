"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDashed, KeyRound, PackageCheck, ShieldAlert } from "lucide-react";
import type { Deal } from "@prisma/client";
import { declareHandoverAction, confirmReceiptAction } from "./delivery-actions";
import { Button, Card, Caution, FormError, Note, SectionTitle } from "@/components/ui";
import { DEAL_METHOD_RULES, HANDOVER_LABEL } from "@/lib/deal-methods";
import type { ActorRole } from "@/lib/deal-transitions";

/**
 * Handover acknowledgement and buyer receipt confirmation — the two things the
 * parties do during delivery. The platform records only that they say it
 * happened; it never carries the thing that changed hands.
 */
export function DeliveryPanel({
  deal,
  role,
  privateData,
}: {
  deal: Deal;
  role: ActorRole;
  privateData: boolean;
}) {
  const rule = deal.method ? DEAL_METHOD_RULES[deal.method] : null;
  if (!rule) return null;

  if (deal.status === "DELIVERING") {
    return <Handover deal={deal} role={role} privateData={privateData} />;
  }
  if (deal.status === "AWAITING_CONFIRMATION") {
    return <Receipt deal={deal} role={role} />;
  }
  return null;
}

function Handover({
  deal,
  role,
  privateData,
}: {
  deal: Deal;
  role: ActorRole;
  privateData: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rule = DEAL_METHOD_RULES[deal.method!];

  const isParty = role === "BUYER" || role === "SELLER";
  const mine =
    role === "BUYER"
      ? deal.handoverDeclaredByBuyerAt
      : role === "SELLER"
        ? deal.handoverDeclaredBySellerAt
        : null;

  function declare(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await declareHandoverAction(deal.id, next);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-2">
        <KeyRound aria-hidden className="size-[18px] text-ink-faint" strokeWidth={1.75} />
        <SectionTitle>Handover</SectionTitle>
      </div>

      <Note>
        What changes hands: <strong className="text-ink">{HANDOVER_LABEL[rule.offPlatformHandover]}</strong>.
        This happens entirely off-platform — in a direct message, as it does
        today. Acknowledge here once it has actually happened.
      </Note>

      <Caution>
        Never paste a private key, seed phrase, or password into this room. The
        platform must never receive one, and a middleman will never ask for it.
      </Caution>

      {privateData ? (
        <p className="flex gap-2.5 rounded-md border border-warn/25 bg-warn-soft p-3 text-meta text-warn">
          <ShieldAlert aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          Once both of you acknowledge, this deal can no longer be cancelled by
          agreement. Only dispute resolution applies from that point.
        </p>
      ) : null}

      <ul className="space-y-2">
        <AckRow label="Buyer" at={deal.handoverDeclaredByBuyerAt} />
        <AckRow label="Seller" at={deal.handoverDeclaredBySellerAt} />
      </ul>

      {isParty ? (
        <div className="space-y-2 border-t border-line pt-4">
          {mine ? (
            <>
              <p className="text-meta text-ok">You acknowledged the handover.</p>
              {!deal.privateDataHandedOverAt ? (
                <Button
                  variant="secondary"
                  size="sm"
                  pending={pending}
                  onClick={() => declare(false)}
                >
                  Withdraw acknowledgement
                </Button>
              ) : null}
            </>
          ) : (
            <Button pending={pending} onClick={() => declare(true)}>
              {pending ? "Recording…" : "The handover has happened"}
            </Button>
          )}
          <FormError message={error} />
        </div>
      ) : null}
    </Card>
  );
}

function Receipt({ deal, role }: { deal: Deal; role: ActorRole }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmReceiptAction(deal.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const confirmed = Boolean(deal.receiptConfirmedAt);

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <PackageCheck aria-hidden className="size-[18px] text-ink-faint" strokeWidth={1.75} />
        <SectionTitle>Receipt</SectionTitle>
      </div>

      {confirmed ? (
        <p className="flex items-center gap-2 text-body text-ok">
          <Check aria-hidden className="size-4" strokeWidth={2.5} />
          The buyer confirmed receipt on{" "}
          <time className="font-mono">
            {deal.receiptConfirmedAt!.toISOString().replace("T", " ").slice(0, 16)} UTC
          </time>
        </p>
      ) : role === "BUYER" ? (
        <>
          <p className="text-body text-ink-muted">
            Check that you received exactly what the terms describe before
            confirming. Confirming lets the middleman release the funds.
          </p>
          <Button pending={pending} onClick={confirm}>
            {pending ? "Recording…" : "Confirm I received it"}
          </Button>
          <FormError message={error} />
        </>
      ) : (
        <Note>
          Waiting on the buyer to confirm they received it. If they stay silent
          past their response window, the middleman can proceed without them.
        </Note>
      )}
    </Card>
  );
}

function AckRow({ label, at }: { label: string; at: Date | null }) {
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
        {at ? at.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "not acknowledged"}
      </span>
    </li>
  );
}
