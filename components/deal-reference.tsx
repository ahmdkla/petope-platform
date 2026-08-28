"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { shortReference } from "@/lib/reference";

/**
 * A deal reference, shortened for display.
 *
 * The full string (`115-TAKASHI-BASECAMPFOUNDATION`) is what a member quotes to
 * a middleman, so it has to be recoverable exactly — the tooltip shows it and
 * the copy button hands it over verbatim. Nothing here parses it; see
 * `lib/reference.ts`.
 */
export function DealReference({
  reference,
  href,
  className = "",
}: {
  reference: string;
  /** Renders the reference as a link to the deal room when given. */
  href?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const short = shortReference(reference);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
    } catch {
      // Clipboard is permission-gated; the title attribute still shows the
      // full reference for manual selection.
    }
  }

  const label = (
    <span className="font-mono text-body font-medium">{short}</span>
  );

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {href ? (
        <Link
          href={href}
          title={reference}
          className="min-w-0 truncate text-accent-text underline underline-offset-2"
        >
          {label}
        </Link>
      ) : (
        <span title={reference} className="min-w-0 truncate text-ink">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        title={copied ? "Copied" : `Copy ${reference}`}
        aria-label={copied ? "Reference copied" : `Copy full reference ${reference}`}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-raised hover:text-ink sm:size-8"
      >
        {copied ? (
          <Check aria-hidden className="size-4 text-ok" strokeWidth={2} />
        ) : (
          <Copy aria-hidden className="size-4" strokeWidth={1.75} />
        )}
      </button>
    </span>
  );
}
