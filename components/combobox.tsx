"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Free-text field with a suggestion list.
 *
 * A plain `<datalist>` filters options to substring matches of the current
 * value, so once a value is set the list collapses to one entry and you have to
 * clear the field to browse again. That is the bug this replaces.
 *
 * Here: the chevron always shows every option regardless of what is typed,
 * typing filters only while you are typing, and focusing selects the existing
 * value so the next keystroke replaces it instead of appending.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  required,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Filter only while typing. Opening from the chevron always shows everything.
  const shown =
    filtering && value.trim()
      ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()))
      : options;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setFiltering(false);
    input.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setFiltering(false);
        setOpen(true);
        setActive(0);
      } else setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrap} className="relative">
      <input
        ref={input}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        // Typing replaces rather than appends to an existing value.
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          onChange(e.target.value);
          setFiltering(true);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className="h-field w-full rounded-md border border-line bg-raised pl-3 pr-10 text-body text-ink
          placeholder:text-ink-faint transition-colors duration-200
          focus:border-accent-line focus:outline-none"
      />

      <button
        type="button"
        // Always shows the full list, whatever is in the field.
        onClick={() => {
          setFiltering(false);
          setOpen((v) => !v);
          setActive(0);
          input.current?.focus();
        }}
        aria-label={open ? "Hide suggestions" : "Show all suggestions"}
        className="absolute right-0 top-0 grid h-field w-10 cursor-pointer place-items-center text-ink-muted transition-colors duration-200 hover:text-ink"
      >
        <ChevronDown
          aria-hidden
          className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {open && shown.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-card py-1 shadow-overlay"
        >
          {shown.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={`flex h-11 w-full cursor-pointer items-center px-3 text-left text-body transition-colors duration-200 ${
                  i === active ? "bg-raised text-ink" : "text-ink-muted"
                } ${o === value ? "font-semibold text-accent-text" : ""}`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
