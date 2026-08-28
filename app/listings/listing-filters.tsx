"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { LISTING_TYPE_LABEL } from "@/lib/listing-meta";

/**
 * Filters live in the URL so a filtered view is shareable and survives back
 * navigation with its state intact.
 */
export function ListingFilters({ chains }: { chains: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  /**
   * The controls follow the click, not the server.
   *
   * `router.push` inside a transition keeps the previous results on screen
   * while the new ones load, which is the right behaviour for a feed — but it
   * also means `useSearchParams` still reports the OLD value until the
   * navigation commits, so a select would visibly snap back to its previous
   * option for the length of the request. `useOptimistic` holds the chosen
   * value over that gap; it is reconciled the moment the URL actually changes.
   *
   * The URL stays the single source of truth. This only covers the in-flight
   * window, so a shared or reloaded link still resolves from the query string.
   */
  const [optimisticParams, setOptimisticParams] = useOptimistic(
    params.toString(),
  );
  const view = new URLSearchParams(optimisticParams);
  const q = view.get("q") ?? "";

  function apply(key: string, value: string) {
    const p = new URLSearchParams(optimisticParams);
    if (!value || value === "ALL") p.delete(key);
    else p.set(key, value);
    const next = p.toString();
    startTransition(() => {
      setOptimisticParams(next);
      router.push(`/listings?${next}`);
    });
  }

  const active = ["chain", "type", "specific", "q"].filter((k) => view.get(k));

  return (
    <div
      aria-busy={pending || undefined}
      className={`flex flex-wrap items-end gap-3 transition-opacity duration-200 ${
        pending ? "opacity-70" : ""
      }`}
    >
      {/* Each field takes a full row on a phone and its natural width from
          `sm` up — four 200px controls wrapped at 375px otherwise leave half
          the row empty. */}
      <Field label="Project" htmlFor="f-q">
        {/* Uncontrolled and keyed on the URL value: the query string is the
            single source of truth, so there is no local state to resync. */}
        <form
          className="w-full"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            apply("q", typeof value === "string" ? value.trim() : "");
          }}
        >
          <Input
            key={q}
            id="f-q"
            name="q"
            defaultValue={q}
            placeholder="Search by name"
            className="w-full sm:w-52"
          />
        </form>
      </Field>

      {/* Project chain — NOT the settlement asset. Labelled to keep them apart. */}
      <Field label="Project chain" htmlFor="f-chain">
        <Select
          id="f-chain"
          value={view.get("chain") ?? "ALL"}
          onChange={(e) => apply("chain", e.target.value)}
          className="w-full sm:w-44"
        >
          <option value="ALL">All chains</option>
          {chains.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Method" htmlFor="f-type">
        <Select
          id="f-type"
          value={view.get("type") ?? "ALL"}
          onChange={(e) => apply("type", e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="ALL">All methods</option>
          {Object.entries(LISTING_TYPE_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Spot type" htmlFor="f-specific">
        <Select
          id="f-specific"
          value={view.get("specific") ?? "ALL"}
          onChange={(e) => apply("specific", e.target.value)}
          className="w-full sm:w-36"
        >
          <option value="ALL">All spots</option>
          <option value="GTD">GTD</option>
          <option value="FCFS">FCFS</option>
        </Select>
      </Field>

      {active.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const p = new URLSearchParams(optimisticParams);
            active.forEach((k) => p.delete(k));
            const next = p.toString();
            startTransition(() => {
              setOptimisticParams(next);
              router.push(`/listings?${next}`);
            });
          }}
          className="flex h-field cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-body text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink"
        >
          <X aria-hidden className="size-4" strokeWidth={2} />
          Clear {active.length}
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-1.5 sm:w-auto">
      <label htmlFor={htmlFor} className="block text-meta font-medium text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
