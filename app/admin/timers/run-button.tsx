"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { runTimersNow } from "./actions";
import type { TimerOutcome } from "@/lib/deal-timers";
import { Button, FormError } from "@/components/ui";
import { Modal } from "@/components/modal";

export function RunTimersButton({ dueCount }: { dueCount: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TimerOutcome[] | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await runTimersNow();
      if (!res.ok) setError(res.error);
      else {
        setResult(res.outcomes);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button disabled={pending} onClick={run}>
        <Play aria-hidden className="size-4" strokeWidth={2} />
        {pending ? "Running" : `Run due timers${dueCount > 0 ? ` (${dueCount})` : ""}`}
      </Button>
      <FormError message={error} />

      {result ? (
        <Modal
          title="Timer run complete"
          onClose={() => setResult(null)}
          footer={
            <Button variant="secondary" onClick={() => setResult(null)}>
              Close
            </Button>
          }
        >
          {result.length === 0 ? (
            <p className="text-body text-ink-muted">
              Nothing was due, so no deal changed. Deals appear here when a
              release deadline has passed and the run moves them on.
            </p>
          ) : (
            <ul className="space-y-3">
              {result.map((o, i) => (
                <li key={`${o.dealId}-${i}`} className="rounded-md border border-line bg-raised p-3">
                  <p className="font-mono text-meta text-ink">{o.reference}</p>
                  <p className="mt-1 text-meta text-ink-muted">{o.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </>
  );
}
