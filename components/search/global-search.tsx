"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Store, Handshake, ShieldCheck, Loader2 } from "lucide-react";
import type { SearchHit } from "@/lib/search-types";

const KIND_ICON = {
  listing: Store,
  deal: Handshake,
  middleman: ShieldCheck,
} as const;

const KIND_LABEL = {
  listing: "Listing",
  deal: "Deal",
  middleman: "Middleman",
} as const;

/**
 * Global search. Cmd/Ctrl-K from anywhere.
 *
 * Deals come back scoped to the caller by the API — a deal room is private, and
 * search must not be a way around that.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Results are stored with the term that produced them, so "is this stale?" is
  // a comparison rather than a second piece of state that can fall out of step.
  const [result, setResult] = useState<{ q: string; hits: SearchHit[] }>({
    q: "",
    hits: [],
  });
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const term = q.trim();
  const hits = result.q === term ? result.hits : [];
  const loading = term.length >= 2 && result.q !== term;

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setActive(0);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Debounced: a request per keystroke would hammer the database for results
  // nobody has finished asking for.
  useEffect(() => {
    if (term.length < 2) return;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { hits: SearchHit[] };
        setResult({ q: term, hits: data.hits });
        setActive(0);
      } catch {
        // Dropped request: the previous results stay on screen rather than the
        // palette blanking out under the user.
      }
    }, 220);
    return () => clearTimeout(id);
  }, [term]);

  const go = useCallback(
    (hit: SearchHit) => {
      close();
      router.push(hit.href);
    },
    [close, router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-11 min-w-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-card px-2.5 text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink sm:px-3"
      >
        <Search aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
        <span className="hidden text-meta lg:inline">Search</span>
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-meta text-ink-faint lg:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-100 flex items-start justify-center p-4 pt-[10vh]">
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 cursor-default bg-black/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-card shadow-overlay"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
              <Search aria-hidden className="size-[18px] shrink-0 text-ink-faint" strokeWidth={1.75} />
              <label htmlFor="global-search" className="sr-only">
                Search listings, deals and middlemen
              </label>
              <input
                ref={input}
                id="global-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search listings, deals, middlemen"
                className="h-14 min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-faint focus:outline-none"
              />
              {loading ? (
                <Loader2
                  aria-hidden
                  className="size-4 shrink-0 animate-spin text-ink-faint"
                  strokeWidth={2}
                />
              ) : null}
            </div>

            <div className="overflow-y-auto">
              {term.length < 2 ? (
                <p className="px-4 py-6 text-meta text-ink-faint">
                  Type at least two characters. Your own deals are searchable by
                  project or reference.
                </p>
              ) : hits.length === 0 && !loading ? (
                <p className="px-4 py-6 text-meta text-ink-muted">
                  Nothing matches “{q}”.
                </p>
              ) : (
                <ul role="listbox" aria-label="Search results">
                  {hits.map((hit, i) => {
                    const Icon = KIND_ICON[hit.kind];
                    return (
                      <li key={`${hit.kind}-${hit.id}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={i === active}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(hit)}
                          className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-200 ${
                            i === active ? "bg-raised" : ""
                          }`}
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-raised text-ink-faint">
                            <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body text-ink">
                              {hit.title}
                            </span>
                            <span className="block truncate text-meta text-ink-faint">
                              {KIND_LABEL[hit.kind]} · {hit.subtitle}
                            </span>
                          </span>
                          {hit.meta ? (
                            <span className="shrink-0 font-mono tnum text-meta text-ink-muted">
                              {hit.meta}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
