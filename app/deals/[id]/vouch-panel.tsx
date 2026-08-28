"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquareQuote, CheckCircle2 } from "lucide-react";
import { leaveVouch } from "@/app/vouches/actions";
import { Button, Card, FormError, Hint, Note, SectionTitle, Textarea } from "@/components/ui";
import type { ActorRole } from "@/lib/deal-transitions";

/**
 * Appears only on a completed deal, only for the buyer and seller.
 *
 * Writing from inside the room is what makes the eligibility rule hold: the
 * deal is implicit rather than chosen from a list. The server re-checks it
 * regardless.
 */
export function VouchPanel({
  dealId,
  role,
  middlemanName,
  alreadyVouched,
}: {
  dealId: string;
  role: ActorRole;
  middlemanName: string;
  alreadyVouched: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (role !== "BUYER" && role !== "SELLER") return null;

  if (alreadyVouched || done) {
    return (
      <Card className="space-y-3">
        <SectionTitle>Vouch</SectionTitle>
        <p className="flex items-center gap-2.5 text-body text-ok">
          <CheckCircle2 aria-hidden className="size-5" strokeWidth={2} />
          You vouched for {middlemanName} on this deal.
        </p>
        <Link
          href="/vouches"
          className="inline-flex text-meta font-medium text-accent-text underline underline-offset-2"
        >
          See it on the vouches page
        </Link>
      </Card>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await leaveVouch({ dealId, body: body.trim() });
      if (!res.ok) setError(res.error);
      else {
        setDone(true);
        router.refresh();
      }
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquareQuote
          aria-hidden
          className="size-[18px] text-ink-faint"
          strokeWidth={1.75}
        />
        <SectionTitle>Leave a vouch</SectionTitle>
      </div>

      <p className="text-body text-ink-muted">
        This deal completed with{" "}
        <span className="font-mono text-ink">{middlemanName}</span> as middleman.
        A short public note helps the next person decide who to trust.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="vouch-body" className="sr-only">
          Your vouch
        </label>
        <Textarea
          id="vouch-body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          placeholder="How did the deal go?"
        />
        <Hint>
          Published on the vouches page and counted on their profile. One vouch
          per person per deal.
        </Hint>
        <FormError message={error} />
        <Button type="submit" pending={pending}>
          {pending ? "Posting…" : "Post vouch"}
        </Button>
      </form>

      <Note>
        Vouches are tied to a completed deal you were part of. That is what
        stops them being manufactured.
      </Note>
    </Card>
  );
}
