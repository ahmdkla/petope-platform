import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Shared primitives. Cards are encouraged as distinct surfaces; borders and
 * soft elevation are both allowed. Body text is 15px, meta 14px, fields 44px.
 */

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`min-w-0 rounded-lg border border-line bg-card p-6 shadow-card ${className}`}
      {...props}
    />
  );
}

export function SectionTitle({ className = "", ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={`text-section font-semibold tracking-tight text-ink ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return (
    <label
      className={`block text-meta font-medium text-ink-muted ${className}`}
      {...props}
    />
  );
}

const FIELD =
  "h-field w-full rounded-md border border-line bg-raised px-3 text-body text-ink " +
  "placeholder:text-ink-faint transition-colors duration-200 " +
  "focus:border-accent-line focus:outline-none disabled:opacity-50";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${FIELD} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${FIELD} cursor-pointer ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`w-full rounded-md border border-line bg-raised px-3 py-2.5 text-body text-ink
        placeholder:text-ink-faint transition-colors duration-200
        focus:border-accent-line focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  // Amber is the brand anchor and is used confidently on primary actions.
  const styles = {
    primary: "bg-accent text-accent-ink hover:brightness-110",
    secondary:
      "border border-line bg-raised text-ink hover:border-line-strong hover:bg-card",
    ghost: "text-ink-muted hover:bg-raised hover:text-ink",
    danger:
      "border border-danger/40 bg-danger-soft text-danger hover:border-danger/70",
  }[variant];

  // Even the compact variant clears 44px on a phone; several of these are
  // confirm/reject on a payment proof, which is not a control to mis-tap.
  const sizing =
    size === "sm" ? "h-11 px-3 text-meta sm:h-9" : "h-field px-4 text-body";

  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md
        font-medium transition-all duration-200 disabled:cursor-not-allowed
        disabled:opacity-50 ${sizing} ${styles} ${className}`}
      {...props}
    />
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-meta text-danger"
    >
      {message}
    </p>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-meta text-ink-faint">{children}</p>;
}

export function Caution({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2.5 text-meta text-warn">
      {children}
    </p>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-line bg-raised px-3 py-2.5 text-meta text-ink-muted">
      {children}
    </p>
  );
}

export type BadgeTone =
  | "neutral"
  | "accent"
  | "ok"
  | "danger"
  | "warn"
  | "info"
  | "buy"
  | "sell";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "border-line bg-raised text-ink-muted",
  accent: "border-accent-line bg-accent-soft text-accent-text",
  ok: "border-ok/30 bg-ok-soft text-ok",
  danger: "border-danger/30 bg-danger-soft text-danger",
  warn: "border-warn/30 bg-warn-soft text-warn",
  info: "border-info/30 bg-info-soft text-info",
  buy: "border-buy/30 bg-buy-soft text-buy",
  sell: "border-sell/30 bg-sell-soft text-sell",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-meta font-medium ${BADGE_TONE[tone]} ${className}`}
      {...props}
    />
  );
}

/** Empty states get an icon and a helpful line. */
export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon?: LucideIcon;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-card px-6 py-12 text-center shadow-card">
      {Icon ? (
        <span className="grid size-11 place-items-center rounded-lg border border-line bg-raised text-ink-faint">
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
      ) : null}
      <p className="max-w-md text-body text-ink-muted">{message}</p>
      {action}
    </div>
  );
}

/** Deterministic avatar tint from an id — no images to host, still identifiable. */
export function Avatar({
  name,
  seed,
  size = "md",
  onShift,
}: {
  name: string;
  seed: string;
  size?: "sm" | "md" | "lg";
  /**
   * Middlemen only. `true` puts a live dot on the tile, `false` a hollow one,
   * `undefined` neither — the last is for people who do not keep shifts at all,
   * where a grey dot would read as "off shift" rather than "not applicable".
   */
  onShift?: boolean;
}) {
  const hues = [28, 45, 160, 200, 260, 340];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
  const hue = hues[h % hues.length];

  const dim = { sm: "size-8 text-meta", md: "size-10 text-body", lg: "size-12 text-lead" }[size];
  const dot = { sm: "size-2.5", md: "size-3", lg: "size-3.5" }[size];

  const tile = (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-lg border border-line font-mono font-semibold uppercase ${dim}`}
      style={{
        backgroundColor: `oklch(0.32 0.07 ${hue})`,
        color: `oklch(0.92 0.09 ${hue})`,
      }}
    >
      {name.slice(0, 2)}
    </span>
  );

  if (onShift === undefined) return tile;

  // Shift state rides on the avatar so it appears everywhere a middleman does,
  // not only on the roster. The ring is the card background so the dot reads as
  // separate from the tile on any surface.
  return (
    <span className="relative inline-flex shrink-0">
      {tile}
      <span
        title={onShift ? "On shift now" : "Off shift"}
        className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card ${dot} ${
          onShift ? "bg-ok" : "border border-line-strong bg-canvas"
        }`}
      >
        <span className="sr-only">{onShift ? "on shift now" : "off shift"}</span>
      </span>
    </span>
  );
}
