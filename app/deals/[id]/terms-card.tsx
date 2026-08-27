import { Pin, Lock, ExternalLink } from "lucide-react";
import type { Deal } from "@prisma/client";
import { Badge, Card, Note, SectionTitle } from "@/components/ui";
import { FeeBreakdown } from "@/components/fee-breakdown";
import { describePriceType } from "@/lib/money";
import { LISTING_TYPE_LABEL } from "@/lib/listing-meta";
import {
  BUYER_PAYS_LABEL,
  DEAL_METHOD_RULES,
  HANDOVER_LABEL,
} from "@/lib/deal-methods";
import type { ActorRole } from "@/lib/deal-transitions";

/**
 * The pinned terms card. Locked at terms_locked; after that, changes need both
 * parties to re-confirm and are written to the audit log.
 */
export function TermsCard({
  deal,
  role,
}: {
  deal: Deal & { listing: { type: string; projectLink: string | null } | null };
  role: ActorRole;
}) {
  const rule = deal.method ? DEAL_METHOD_RULES[deal.method] : null;
  const locked = Boolean(deal.termsLockedAt);

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2">
          <Pin aria-hidden className="size-4 text-ink-faint" strokeWidth={2} />
          <SectionTitle>Deal terms</SectionTitle>
        </span>
        {locked ? (
          <Badge tone="info">
            <Lock aria-hidden className="size-3.5" strokeWidth={2} />
            Locked
          </Badge>
        ) : (
          <Badge tone="warn">Not locked</Badge>
        )}
      </div>

      {/* Broken out rather than a single total: the fee is charged on top of
          the deal amount, and the collateral is the seller's, not the buyer's. */}
      <FeeBreakdown
        lines={{
          dealAmount: deal.dealAmount,
          mmFee: deal.mmFee,
          collateral: deal.collateralAmount ?? 0n,
          mintPrice: rule?.buyerPays.includes("mint_price") ? (deal.mintPrice ?? 0n) : 0n,
          asset: deal.asset,
          atFloor: false,
        }}
      />

      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Field label="Project" value={deal.projectName} />
        <Field label="Project chain" value={deal.chain} />
        <Field
          label="Quantity"
          value={`${deal.quantity} ${deal.quantity === 1 ? "spot" : "spots"} (${describePriceType(deal.priceType)})`}
          mono
        />
        <Field label="Spot type" value={deal.specific} />
        <Field
          label="Mint date"
          value={deal.mintAt ? deal.mintAt.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "not set"}
          mono={Boolean(deal.mintAt)}
        />
        <Field label="Batch" value={String(deal.batchNumber)} mono />
      </dl>

      {rule ? (
        <div className="space-y-3 rounded-lg border border-line bg-raised p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-body font-semibold text-ink">{rule.label}</h3>
            <Badge tone="accent">Escrow method</Badge>
          </div>
          <p className="text-body text-ink-muted">{rule.summary}</p>

          <dl className="grid gap-3 sm:grid-cols-2">
            <MethodFact
              label="Buyer pays"
              value={rule.buyerPays.map((p) => BUYER_PAYS_LABEL[p]).join(" + ")}
            />
            <MethodFact
              label="Handover, off-platform"
              value={HANDOVER_LABEL[rule.offPlatformHandover]}
            />
          </dl>

          <ul className="space-y-1.5 border-t border-line pt-3">
            {rule.partyNotes.map((n) => (
              <li key={n} className="flex gap-2 text-meta text-ink-muted">
                <span aria-hidden className="text-ink-faint">
                  —
                </span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Note>
          No escrow method has been agreed yet.
          {deal.listing
            ? ` The listing suggested ${LISTING_TYPE_LABEL[deal.listing.type as keyof typeof LISTING_TYPE_LABEL]}, but that is only a starting point.`
            : ""}{" "}
          The middleman proposes the exact flow and both parties confirm it
          before terms can be locked.
        </Note>
      )}

      {deal.listing?.projectLink ? (
        <a
          href={deal.listing.projectLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-meta font-medium text-accent-text underline underline-offset-2"
        >
          Project link
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={2} />
        </a>
      ) : null}

      {locked && role !== "MIDDLEMAN" ? (
        <Note>
          Terms are locked. Any change from here needs both parties to
          re-confirm and is recorded in the audit log.
        </Note>
      ) : null}
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-meta text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 text-body font-medium text-ink ${mono ? "font-mono tnum" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function MethodFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-meta text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-meta text-ink">{value}</dd>
    </div>
  );
}
