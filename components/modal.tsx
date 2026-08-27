"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Overlay. Shadow and scrim are allowed here — elevation is their job, and the
 * scrim isolates the foreground. Escape and the scrim both dismiss.
 */
export function Modal({
  title,
  children,
  footer,
  onClose,
  size = "md",
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  /** "lg" for forms that would otherwise scroll in a narrow column. */
  size?: "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[calc(100dvh-4rem)] w-full flex-col rounded-xl border border-line bg-card shadow-overlay outline-none ${
          size === "lg" ? "max-w-3xl" : "max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-section font-semibold tracking-tight text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-9 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors duration-200 hover:bg-raised hover:text-ink"
          >
            <X aria-hidden className="size-[18px]" strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 text-left">{children}</div>

        {footer ? (
          <div className="flex shrink-0 justify-end gap-3 border-t border-line px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
