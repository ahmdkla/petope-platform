"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewReport } from "@/app/report/actions";
import { Button, FormError, Hint, Label, Note, Textarea } from "@/components/ui";

export function ReviewForm({
  reportId,
  canBlacklist,
  alreadyBlacklisted,
  accusedName,
}: {
  reportId: string;
  canBlacklist: boolean;
  alreadyBlacklisted: boolean;
  accusedName: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [blacklist, setBlacklist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(decision: "uphold" | "dismiss") {
    setError(null);
    startTransition(async () => {
      const res = await reviewReport({
        reportId,
        decision,
        note: note.trim() || null,
        blacklist: decision === "uphold" && blacklist,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div className="space-y-1.5">
        <Label htmlFor={`note-${reportId}`}>Review note</Label>
        <Textarea
          id={`note-${reportId}`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="What you found."
        />
        <Hint>
          Required to dismiss. If you blacklist, this becomes the public reason —
          write it for the person reading the blacklist page.
        </Hint>
      </div>

      {canBlacklist && !alreadyBlacklisted ? (
        <label className="flex cursor-pointer items-start gap-2.5 text-body text-ink-muted">
          <input
            type="checkbox"
            checked={blacklist}
            onChange={(e) => setBlacklist(e.target.checked)}
            className="mt-1 size-4 cursor-pointer rounded-md border-line bg-raised accent-accent"
          />
          <span>
            Also blacklist <span className="font-mono text-ink">{accusedName}</span>.
            Their sessions stop working on the next request and they appear on the
            public blacklist.
          </span>
        </label>
      ) : null}

      {alreadyBlacklisted ? (
        <Note>This account is already blacklisted.</Note>
      ) : null}

      {!canBlacklist ? (
        <Note>
          No account here matches that handle, so there is nothing to blacklist.
          Upholding still records the finding — the usual case for a Discord
          impersonator.
        </Note>
      ) : null}

      <FormError message={error} />

      <div className="flex flex-wrap gap-3">
        <Button variant="danger" pending={pending} onClick={() => decide("uphold")}>
          {pending ? "Recording…" : blacklist ? "Uphold and blacklist" : "Uphold"}
        </Button>
        <Button variant="secondary" pending={pending} onClick={() => decide("dismiss")}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
