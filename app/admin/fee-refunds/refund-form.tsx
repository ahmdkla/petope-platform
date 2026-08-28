"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundMmFee } from "./actions";
import { Button, FormError, Hint, Label, Textarea } from "@/components/ui";

export function RefundForm({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await refundMmFee({ dealId, reason: reason.trim() });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="border-t border-line pt-3">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Refund the fee
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-line pt-4">
      <div className="space-y-1.5">
        <Label htmlFor={`reason-${dealId}`}>Why is this refundable?</Label>
        <Textarea
          id={`reason-${dealId}`}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          maxLength={2000}
          placeholder="What made this a scammer case."
          autoFocus
        />
        <Hint>Recorded in the ledger against your name and posted in the room.</Hint>
      </div>
      <FormError message={error} />
      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Refunding" : "Refund fee"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
