"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore, useCallback } from "react";
import {
  CalendarDays,
  ChevronRight,
  Gavel,
  Handshake,
  LayoutGrid,
  LifeBuoy,
  MessageSquareQuote,
  CircleHelp,
  ShieldCheck,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type SubItem = {
  href: string;
  label: string;
  match: (path: string, q: URLSearchParams) => boolean;
};
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  children?: SubItem[];
};

const PRIMARY: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid, exact: true },
  {
    href: "/listings",
    label: "Marketplace",
    icon: Store,
    children: [
      {
        href: "/listings?side=SELL",
        label: "Selling",
        match: (p, q) => p === "/listings" && q.get("side") !== "BUY" && q.get("status") !== "sold-out",
      },
      {
        href: "/listings?side=BUY",
        label: "Buying",
        match: (p, q) => p === "/listings" && q.get("side") === "BUY" && q.get("status") !== "sold-out",
      },
      {
        href: "/listings?status=sold-out",
        label: "Sold out",
        match: (p, q) => p === "/listings" && q.get("status") === "sold-out",
      },
    ],
  },
  {
    href: "/deals",
    label: "My deals",
    icon: Handshake,
    children: [
      { href: "/deals?role=buyer", label: "As buyer", match: (p, q) => p === "/deals" && q.get("role") === "buyer" },
      { href: "/deals?role=seller", label: "As seller", match: (p, q) => p === "/deals" && q.get("role") === "seller" },
      { href: "/deals?role=middleman", label: "As middleman", match: (p, q) => p === "/deals" && q.get("role") === "middleman" },
    ],
  },
  {
    href: "/middlemen",
    label: "Middlemen",
    icon: ShieldCheck,
    children: [
      { href: "/middlemen", label: "Roster", match: (p, q) => p === "/middlemen" && q.get("filter") !== "on-shift" },
      { href: "/middlemen?filter=on-shift", label: "On shift now", match: (p, q) => p === "/middlemen" && q.get("filter") === "on-shift" },
    ],
  },
];

const SECONDARY: NavItem[] = [
  { href: "/mints", label: "Mints", icon: CalendarDays },
  { href: "/vouches", label: "Vouches", icon: MessageSquareQuote },
  { href: "/support", label: "Support", icon: LifeBuoy },
  {
    href: "/faqs",
    label: "Help",
    icon: CircleHelp,
    children: [
      { href: "/faqs", label: "FAQs", match: (p) => p === "/faqs" },
      { href: "/report", label: "Report a scammer", match: (p) => p === "/report" },
      { href: "/blacklist", label: "Blacklist", match: (p) => p === "/blacklist" },
    ],
  },
];

const MIDDLEMAN: NavItem[] = [{ href: "/queue", label: "Queue", icon: Gavel }];

const ADMIN: NavItem[] = [
  {
    href: "/admin/disputes",
    label: "Admin",
    icon: Wrench,
    children: [
      { href: "/admin/disputes", label: "Disputes", match: (p) => p.startsWith("/admin/disputes") },
      { href: "/admin/reports", label: "Reports", match: (p) => p.startsWith("/admin/reports") },
      { href: "/admin/users", label: "Users", match: (p) => p.startsWith("/admin/users") },
      { href: "/admin/timers", label: "Timers", match: (p) => p.startsWith("/admin/timers") },
      { href: "/admin/fee-refunds", label: "Fee refunds", match: (p) => p.startsWith("/admin/fee-refunds") },
      { href: "/admin/settings", label: "Settings", match: (p) => p.startsWith("/admin/settings") },
    ],
  },
];

/* --- expanded state, persisted ------------------------------------------- */

const KEY = "exsaverse-nav-expanded";
const EVENT = "exsaverse-nav-change";

function readExpanded(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Persisted left sidebar — mirrors the Discord model these users know. */
export function Sidebar({
  showQueue = false,
  showAdmin = false,
}: {
  showQueue?: boolean;
  showAdmin?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  // The DOM/localStorage is the store; no setState-in-effect.
  const raw = useSyncExternalStore(subscribe, readExpanded, () => "");
  const expanded = new Set(raw.split(",").filter(Boolean));

  const toggle = useCallback(
    (href: string) => {
      const next = new Set(readExpanded().split(",").filter(Boolean));
      if (next.has(href)) next.delete(href);
      else next.add(href);
      try {
        localStorage.setItem(KEY, [...next].join(","));
      } catch {
        // Private browsing: the section still toggles for this page view.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [],
  );

  const items = [
    ...PRIMARY,
    ...SECONDARY,
    ...(showQueue ? MIDDLEMAN : []),
    // Only ADMIN and MAIN_MIDDLEMAN see this; app/admin/layout.tsx enforces it.
    ...(showAdmin ? ADMIN : []),
  ];

  return (
    <nav aria-label="Primary" className="flex w-60 shrink-0 flex-col border-r border-line bg-card">
      <Link href="/" className="flex h-16 items-center gap-2.5 border-b border-line px-5">
        <span className="grid size-7 place-items-center rounded-md bg-accent font-mono text-meta font-bold text-accent-ink">
          E
        </span>
        <span className="font-mono text-lead font-semibold tracking-tight text-ink">
          EXSAVERSE
        </span>
      </Link>

      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const onSection = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          // A section you are inside is open whether or not you expanded it.
          const isOpen = expanded.has(item.href) || onSection;

          return (
            <li key={item.href}>
              <div className="flex items-center gap-1">
                <Link
                  href={item.href}
                  aria-current={onSection ? "page" : undefined}
                  className={`flex h-11 flex-1 items-center gap-3 rounded-md px-3 text-body transition-colors duration-200 ${
                    onSection
                      ? "bg-accent-soft font-medium text-accent-text"
                      : "text-ink-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
                  {item.label}
                </Link>

                {item.children ? (
                  <button
                    type="button"
                    onClick={() => toggle(item.href)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label}`}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-raised hover:text-ink"
                  >
                    <ChevronRight
                      aria-hidden
                      className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      strokeWidth={2}
                    />
                  </button>
                ) : null}
              </div>

              {item.children && isOpen ? (
                <ul className="mt-1 space-y-0.5 border-l border-line pl-3 ml-5">
                  {item.children.map((child) => {
                    const active = child.match(pathname, params);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex h-9 items-center rounded-md px-3 text-meta transition-colors duration-200 ${
                            active
                              ? "bg-raised font-medium text-ink"
                              : "text-ink-faint hover:bg-raised hover:text-ink-muted"
                          }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line p-3">
        <p className="px-3 text-meta text-ink-faint">Middlemen never DM first.</p>
      </div>
    </nav>
  );
}
