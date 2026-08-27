"use client";

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
  const q = params.get("q") ?? "";

  function apply(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (!value || value === "ALL") p.delete(key);
    else p.set(key, value);
    router.push(`/listings?${p.toString()}`);
  }

  const active = ["chain", "type", "specific", "q"].filter((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Project" htmlFor="f-q">
        {/* Uncontrolled and keyed on the URL value: the query string is the
            single source of truth, so there is no local state to resync. */}
        <form
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
            className="w-52"
          />
        </form>
      </Field>

      {/* Project chain — NOT the settlement asset. Labelled to keep them apart. */}
      <Field label="Project chain" htmlFor="f-chain">
        <Select
          id="f-chain"
          value={params.get("chain") ?? "ALL"}
          onChange={(e) => apply("chain", e.target.value)}
          className="w-44"
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
          value={params.get("type") ?? "ALL"}
          onChange={(e) => apply("type", e.target.value)}
          className="w-48"
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
          value={params.get("specific") ?? "ALL"}
          onChange={(e) => apply("specific", e.target.value)}
          className="w-36"
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
            const p = new URLSearchParams(params.toString());
            active.forEach((k) => p.delete(k));
            router.push(`/listings?${p.toString()}`);
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
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-meta font-medium text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
