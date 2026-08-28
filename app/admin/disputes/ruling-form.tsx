"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { recordRuling } from "./actions";
import { Button, FormError, Hint, Label, Note, Select, Textarea } from "@/components/ui";

const OUTCOMES = [
  { value: "release_to_seller", label: "Release funds to the seller" },
  { value: "refund_buyer", label: "Refund the buyer" },
  { value: "split", label: "Split between the parties" },
  { value: "other", label: "Other — described below" },
] as const;

export function RulingForm({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]["value"]>(
    "release_to_seller",
  );
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordRuling({ dealId, outcome, reasoning: reasoning.trim() });
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        setReasoning("");
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <div className="border-t border-line pt-4">
        <Button onClick={() => setOpen(true)}>
          <Gavel aria-hidden className="size-[18px]" strokeWidth={2} />
          Record a ruling
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-line pt-5">
      <div className="space-y-1.5">
        <Label htmlFor={`outcome-${dealId}`}>Outcome</Label>
        <Select
          id={`outcome-${dealId}`}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as typeof outcome)}
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`reasoning-${dealId}`}>Reasoning</Label>
        <Textarea
          id={`reasoning-${dealId}`}
          rows={4}
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          required
          maxLength={4000}
          placeholder="What you decided and why."
        />
        <Hint>
          Written to the audit log against your name and posted into the room.
          It is the permanent account of this decision.
        </Hint>
      </div>

      <Note>
        Recording a ruling does not move money. The assigned middleman carries it
        out through the normal steps, recording the outgoing payment as usual —
        a judgement and an irreversible payout stay separate actions.
      </Note>

      <FormError message={error} />

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Recording" : "Record ruling"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
