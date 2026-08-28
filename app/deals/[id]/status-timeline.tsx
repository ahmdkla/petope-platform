import type { Deal, DealStatus } from "@prisma/client";
import { CircleSlash, TriangleAlert, Undo2 } from "lucide-react";
import { Card, SectionTitle, Badge } from "@/components/ui";
import { DEAL_STATUS_LABEL } from "@/lib/deal-meta";
import {
  STAGES,
  isOffPath,
  stageIndexOf,
  stageSentence,
  OFF_PATH_TITLE,
} from "@/lib/deal-stages";

/**
 * Where the deal is now — not a history of how it got here.
 *
 * The chronological record lives in the activity feed beside the conversation,
 * where a status change sits next to the message that prompted it. Repeating it
 * as a stamped timeline here meant two orderings of the same events, and the
 * one in the sidebar was always the less useful of the two. What is left is the
 * five-stage indicator: which stage, and one sentence naming who is holding it.
 */
export function StatusTimeline({ deal }: { deal: Deal }) {
  // A deal that left the path does not get a stepper with a missing step —
  // it gets a panel explaining where it actually went.
  if (isOffPath(deal.status)) return <OffPathPanel deal={deal} />;

  const currentIndex = stageIndexOf(deal.status);
  const current = STAGES[currentIndex];

  return (
    <Card className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>Progress</SectionTitle>
        <span className="font-mono tnum text-meta text-ink-faint">
          {currentIndex + 1} of {STAGES.length}
        </span>
      </div>

      {/* Segments rather than a numbered list: it reads at a glance and stays
          legible in a 22rem sidebar and on a phone alike. */}
      <ol className="flex gap-1.5">
        {STAGES.map((stage, i) => (
          <li key={stage.id} className="flex-1">
            <span
              aria-hidden
              className={`block h-1.5 rounded-full ${
                i < currentIndex
                  ? "bg-ok"
                  : i === currentIndex
                    ? "bg-accent"
                    : "bg-line"
              }`}
            />
            <span className="sr-only">
              {stage.label}
              {i < currentIndex
                ? " — done"
                : i === currentIndex
                  ? " — in progress"
                  : " — not started"}
            </span>
          </li>
        ))}
      </ol>

      <div>
        <p className="text-lead font-semibold text-ink">{current.label}</p>
        <p className="mt-1.5 text-body text-ink-muted">{stageSentence(deal)}</p>
      </div>

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
