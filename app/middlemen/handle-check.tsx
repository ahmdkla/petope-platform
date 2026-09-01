"use client";

import { useState } from "react";
import { ShieldCheck, ShieldX, TriangleAlert, Search } from "lucide-react";
import { Input, Label } from "@/components/ui";
import { checkHandle } from "@/lib/handles";

/**
 * Type a handle, get a definitive answer.
 *
 * Scanning cards for a handle is exactly the moment impersonation succeeds: a
 * person under time pressure, comparing `mirrors_mm` against `mirrorsmm` by eye,
 * decides they match. This asks the question for them and answers it in words.
 *
 * The whole roster is passed in and matched on the client. That is deliberate:
 * the answer is definitive only if it is checked against the complete list, and
 * a server round trip could not make it more so — the list is public, small, and
 * already on the page.
 */
export function HandleCheck({ roster }: { roster: string[] }) {
  const [typed, setTyped] = useState("");
  const verdict = checkHandle(typed, roster);

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="handle-check">Check a handle</Label>
        <p className="mt-1 text-meta text-ink-muted">
          Paste the exact handle that messaged you. Do not retype it — copying it
          is the point.
        </p>
      </div>

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-faint"
          strokeWidth={1.75}
        />
        <Input
          id="handle-check"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="e.g. nadia"
          autoComplete="off"
          spellCheck={false}
          className="pl-10 font-mono"
        />
      </div>

      {/* aria-live: the verdict is the whole point of the control, and it
          appears without any further interaction. */}
      <div aria-live="polite">
        {verdict.kind === "match" ? (
          <p className="flex items-start gap-2.5 rounded-md border border-ok/30 bg-ok-soft p-3 text-body text-ok">
            <ShieldCheck aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2} />
            <span>
              <span className="font-mono font-semibold">{verdict.handle}</span> is
              a middleman, listed below. They still never DM you first.
            </span>
          </p>
        ) : null}

        {verdict.kind === "lookalike" ? (
          <p className="flex items-start gap-2.5 rounded-md border border-danger/40 bg-danger-soft p-3 text-body text-danger">
            <TriangleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2} />
            <span>
              <span className="font-mono font-semibold">{verdict.typed}</span> is{" "}
              <strong>not</strong> a middleman — but it is one character-swap away
              from <span className="font-mono font-semibold">{verdict.real}</span>,
              who is. That is what an impersonator builds on purpose. Do not send
              anything.
            </span>
          </p>
        ) : null}

        {verdict.kind === "absent" ? (
          <p className="flex items-start gap-2.5 rounded-md border border-danger/40 bg-danger-soft p-3 text-body text-danger">
            <ShieldX aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2} />
            <span>
              <span className="font-mono font-semibold">{verdict.typed}</span> is{" "}
              <strong>not</strong> a middleman. Nobody by that handle is on this
              roster.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
