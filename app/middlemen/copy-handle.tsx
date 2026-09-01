"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The exact handle, with a copy button.
 *
 * Character-for-character comparison is the defence now that the badge is gone,
 * and retyping a handle to compare it defeats the purpose — a person who
 * mistypes it the same way twice concludes it matches. Copying gives them the
 * real string to paste against whatever contacted them.
 */
export function CopyHandle({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
    } catch {
      // Clipboard is permission-gated; the handle is selectable either way.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy ${handle}`}
      aria-label={copied ? `${handle} copied` : `Copy the exact handle ${handle}`}
      className="group flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-raised px-3 py-2 text-left transition-colors duration-200 hover:border-line-strong sm:min-h-0"
    >
      {/* select-all: a double-click takes the whole handle, not a word of it. */}
      <span className="min-w-0 flex-1 select-all truncate font-mono text-body text-ink">
        {handle}
      </span>
      {copied ? (
        <Check aria-hidden className="size-4 shrink-0 text-ok" strokeWidth={2} />
      ) : (
        <Copy
          aria-hidden
          className="size-4 shrink-0 text-ink-faint transition-colors duration-200 group-hover:text-ink"
          strokeWidth={1.75}
        />
      )}
    </button>
  );
}
