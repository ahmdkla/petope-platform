import type { Deal, DealStatus } from "@prisma/client";
import { Check, CircleSlash, TriangleAlert, Undo2 } from "lucide-react";
import { Card, SectionTitle, Badge } from "@/components/ui";
import { DEAL_STATUS_LABEL } from "@/lib/deal-meta";
import {
  STAGES,
  isOffPath,
  stageIndexOf,
  stageSentence,
  OFF_PATH_TITLE,
} from "@/lib/deal-stages";

/** The earliest timestamp that marks each stage as reached. */
const STAGE_STAMP: Record<string, keyof Deal> = {
  terms: "createdAt",
  payment: "fundedAt",
  delivery: "termsLockedAt",
  complete: "completedAt",
};

export function StatusTimeline({ deal }: { deal: Deal }) {
  // A deal that left the path does not get a timeline with a missing step —
  // it gets a panel explaining where it actually went.
  if (isOffPath(deal.status)) return <OffPathPanel deal={deal} />;

  const currentIndex = stageIndexOf(deal.status);

  return (
    <Card className="space-y-4">
      <SectionTitle>Progress</SectionTitle>

      <ol className="space-y-0">
        {STAGES.map((stage, i) => {
          const done = currentIndex > i;
          const current = currentIndex === i;
          const last = i === STAGES.length - 1;
          const stampField = STAGE_STAMP[stage.id];
          const stamp = done && stampField ? (deal[stampField] as Date | null) : null;

          return (
            <li key={stage.id} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-md border ${
                    current
                      ? "border-accent bg-accent text-accent-ink"
                      : done
                        ? "border-ok/40 bg-ok-soft text-ok"
                        : "border-line bg-raised text-ink-faint"
                  }`}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    <span className="font-mono tnum text-[0.6875rem]">{i + 1}</span>
                  )}
                </span>
                {!last ? (
                  <span
                    aria-hidden
                    className={`w-px flex-1 ${done ? "bg-ok/40" : "bg-line"}`}
                    style={{ minHeight: current ? "3rem" : "1.5rem" }}
                  />
                ) : null}
              </span>

              <span className={last ? "pb-0" : "pb-5"}>
                <span
                  className={`block text-body ${
                    current
                      ? "font-semibold text-ink"
                      : done
                        ? "text-ink-muted"
                        : "text-ink-faint"
                  }`}
                >
                  {stage.label}
                </span>

                {/* Only the current stage explains itself — the rest would be
                    noise, and a finished stage needs no instructions. */}
                {current ? (
                  <span className="mt-1 block text-meta text-ink-muted">
                    {stageSentence(deal)}
                  </span>
                ) : null}

                {stamp ? (
                  <span className="mt-0.5 block font-mono text-meta text-ink-faint">
                    {stamp.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {deal.status === "FUNDED" ? (
        <p className="border-t border-line pt-4 text-meta text-ink-muted">
          Spots on the listing were reserved when this deal funded.
        </p>
      ) : null}
    </Card>
  );
}

const OFF_PATH_META: Record<
  string,
  { tone: "danger" | "neutral"; icon: typeof TriangleAlert }
> = {
  DISPUTED: { tone: "danger", icon: TriangleAlert },
  REFUNDED: { tone: "danger", icon: Undo2 },
  CANCELLED: { tone: "neutral", icon: CircleSlash },
};

function OffPathPanel({ deal }: { deal: Deal }) {
  const meta = OFF_PATH_META[deal.status] ?? OFF_PATH_META.CANCELLED;
  const Icon = meta.icon;
  const reached = STAGES.filter((s) =>
    s.states.some((st) => stageReached(deal, st)),
  );

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>{OFF_PATH_TITLE[deal.status] ?? "Closed"}</SectionTitle>
        <Badge tone={meta.tone}>
          <Icon aria-hidden className="size-3.5" strokeWidth={2} />
          {DEAL_STATUS_LABEL[deal.status]}
        </Badge>
      </div>

      <p className="text-body text-ink-muted">{stageSentence(deal)}</p>

      {deal.escalationReason ? (
        <div className="rounded-md border border-line bg-raised p-3">
          <p className="text-meta text-ink-faint">Reason</p>
          <p className="mt-1 text-meta text-ink">{deal.escalationReason}</p>
        </div>
      ) : null}

      {reached.length > 0 ? (
        <div className="border-t border-line pt-4">
          <p className="text-meta text-ink-faint">Reached before closing</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {reached.map((s) => (
              <Badge key={s.id} tone="neutral">
                {s.label}
              </Badge>
            ))}
          </p>
        </div>
      ) : null}

      {deal.spotsReservedAt === null && deal.status !== "DISPUTED" ? (
        <p className="text-meta text-ink-muted">
          Any spots this deal held were returned to the listing.
        </p>
      ) : null}
    </Card>
  );
}

/** Best-effort: which stages this deal got through before leaving the path. */
function stageReached(deal: Deal, status: DealStatus): boolean {
  switch (status) {
    case "OPEN":
      return true;
    case "CLAIMED":
      return Boolean(deal.claimedAt);
    case "TERMS_LOCKED":
      return Boolean(deal.termsLockedAt);
    case "AWAITING_PAYMENT":
    case "FUNDED":
      return Boolean(deal.fundedAt);
    case "DELIVERING":
    case "AWAITING_MINT":
      return Boolean(deal.handoverDeclaredByBuyerAt || deal.handoverDeclaredBySellerAt);
    case "AWAITING_CONFIRMATION":
      return Boolean(deal.receiptConfirmedAt);
    case "COMPLETED":
      return Boolean(deal.completedAt);
    default:
      return false;
  }
}
