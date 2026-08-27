import type { ComponentProps } from "react";

/**
 * The small shared primitives. Deliberately plain: flat surfaces, 6px radius
 * ceiling, no shadows outside overlays, colour only where it carries meaning.
 */

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-md border border-line bg-panel p-5 ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return (
    <label
      className={`block text-xs font-medium text-ink-muted ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`h-9 w-full rounded-md border border-line bg-raised px-2.5 text-sm text-ink
        placeholder:text-ink-faint focus:border-line-strong focus:outline-none
        focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-accent text-accent-ink hover:opacity-90"
      : "border border-line bg-raised text-ink hover:border-line-strong";
  return (
    <button
      className={`h-9 rounded-md px-3 text-sm font-medium transition-opacity
        disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

/** Plain statement of what went wrong. No exclamation marks, no apology. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
    >
      {message}
    </p>
  );
}
