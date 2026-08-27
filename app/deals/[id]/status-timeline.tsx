import type { Deal, DealStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { Card, SectionTitle, Badge } from "@/components/ui";
import { DEAL_STATUS_LABEL, LIFECYCLE_ORDER, TERMINAL_STATES } from "@/lib/deal-meta";

/** Where each state was reached, when the deal records it. */
const STAMP: Partial<Record<DealStatus, keyof Deal>> = {
  OPEN: "createdAt",
  CLAIMED: "claimedAt",
  TERMS_LOCKED: "termsLockedAt",
  FUNDED: "fundedAt",
  COMPLETED: "completedAt",
};

export function StatusTimeline({ deal }: { deal: Deal }) {
  const terminal = TERMINAL_STATES.includes(deal.status);
  const currentIndex = LIFECYCLE_ORDER.indexOf(deal.status);

  return (
    <Card className="space-y-4">
      <SectionTitle>Lifecycle</SectionTitle>

      <ol className="relative space-y-0">
        {LIFECYCLE_ORDER.map((s, i) => {
          const done = !terminal && currentIndex > i;
          const current = deal.status === s;
          const stampField = STAMP[s];
          const stamp = stampField ? (deal[stampField] as Date | null) : null;
          const last = i === LIFECYCLE_ORDER.length - 1;

          return (
            <li key={s} className="flex gap-3">
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
                    style={{ minHeight: "1.25rem" }}
                  />
                ) : null}
              </span>

              <span className={`pb-5 ${last ? "pb-0" : ""}`}>
                <span
                  className={`block text-body ${
                    current
                      ? "font-semibold text-ink"
                      : done
                        ? "text-ink-muted"
                        : "text-ink-faint"
                  }`}
                >
                  {DEAL_STATUS_LABEL[s]}
                </span>
                {stamp ? (
                  <span className="block font-mono text-meta text-ink-faint">
                    {stamp.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {terminal ? (
        <div className="border-t border-line pt-4">
          <Badge tone={deal.status === "CANCELLED" ? "neutral" : "danger"}>
            {DEAL_STATUS_LABEL[deal.status]}
          </Badge>
          <p className="mt-2 text-meta text-ink-muted">
            This deal ended before completing the lifecycle.
          </p>
        </div>
      ) : null}

      {/* Step 3 stops here deliberately; proofs and funding are step 4. */}
      {deal.status === "AWAITING_PAYMENT" ? (
        <p className="border-t border-line pt-4 text-meta text-ink-muted">
          Payment proof submission and middleman verification are not built yet.
          The deal stops here for now.
        </p>
      ) : null}
    </Card>
  );
}
