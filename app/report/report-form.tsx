"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { fileReport } from "./actions";
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
  Textarea,
} from "@/components/ui";
import { REPORT_CATEGORY_HINT, REPORT_CATEGORY_LABEL } from "@/lib/report-meta";
import type { ReportCategory } from "@prisma/client";

const CATEGORIES: ReportCategory[] = ["SCAM", "DM_IMPERSONATION", "ALT_ACCOUNT", "OTHER"];

export function ReportForm() {
  const [category, setCategory] = useState<ReportCategory>("SCAM");
  const [handle, setHandle] = useState("");
  const [evidence, setEvidence] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [dealRef, setDealRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fileReport({
        accusedHandle: handle.trim(),
        category,
        evidence: evidence.trim(),
        evidenceUrl: evidenceUrl.trim() || null,
        dealReference: dealRef.trim() || null,
      });
      if (!res.ok) setError(res.error);
      else {
        setSent(true);
        setHandle("");
        setEvidence("");
        setEvidenceUrl("");
        setDealRef("");
      }
    });
  }

  if (sent) {
    return (
      <Card className="space-y-4">
        <p className="flex items-center gap-2.5 text-body text-ok">
          <CheckCircle2 aria-hidden className="size-5" strokeWidth={2} />
          Report filed. It is now with the middleman team.
        </p>
        <p className="text-body text-ink-muted">
          Nothing is published while it is under review. You will see the outcome
          beside your reports.
        </p>
        <Button variant="secondary" onClick={() => setSent(false)}>
          File another
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <SectionTitle>What happened?</SectionTitle>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {REPORT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
          <Hint>{REPORT_CATEGORY_HINT[category]}</Hint>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="handle">
            Who are you reporting? <span aria-hidden className="text-danger">*</span>
          </Label>
          <Input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            required
            maxLength={120}
            placeholder="Their handle, exactly as you saw it"
            className="font-mono"
          />
          <Hint>
            Copied exactly. If they have an account here it is matched
            automatically; an off-platform impersonator often has none.
          </Hint>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="evidence">
            What did they do? <span aria-hidden className="text-danger">*</span>
          </Label>
          <Textarea
            id="evidence"
            rows={6}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            required
            maxLength={4000}
            placeholder="What happened, when, and what was lost."
          />
          <Hint>
            A reviewer has to be able to act on this. Dates, amounts and handles
            help; a single line rarely does.
          </Hint>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="evidenceUrl">Evidence link</Label>
            <Input
              id="evidenceUrl"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
            />
            <Hint>
              Screenshot or transaction link. File upload is not wired up yet, so
              paste a link. The reviewer opens it themselves.
            </Hint>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dealRef">Deal reference</Label>
            <Input
              id="dealRef"
              value={dealRef}
              onChange={(e) => setDealRef(e.target.value)}
              placeholder="04-BUYERONE-PROJECT"
              className="font-mono"
            />
            <Hint>If this happened inside a deal, its reference.</Hint>
          </div>
        </div>

        <Note>
          Never include a private key, seed phrase or password in a report, even
          as evidence. The platform must never receive one.
        </Note>

        <FormError message={error} />

        <Button type="submit" disabled={pending}>
          {pending ? "Filing" : "File report"}
        </Button>
      </form>
    </Card>
  );
}
