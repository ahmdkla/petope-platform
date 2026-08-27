"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShieldCheck, Handshake, Store, type LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const PRIMARY: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/listings", label: "Marketplace", icon: Store },
  { href: "/deals", label: "My deals", icon: Handshake },
  { href: "/middlemen", label: "Middlemen", icon: ShieldCheck },
];

/** Persistent left sidebar — mirrors the Discord model these users know. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="flex w-60 shrink-0 flex-col border-r border-line bg-card"
    >
      <Link
        href="/"
        className="flex h-16 items-center gap-2.5 border-b border-line px-5"
      >
        <span className="grid size-7 place-items-center rounded-md bg-accent font-mono text-meta font-bold text-accent-ink">
          E
        </span>
        <span className="font-mono text-lead font-semibold tracking-tight text-ink">
          EXSAVERSE
        </span>
      </Link>

      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {PRIMARY.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-md px-3 text-body transition-colors duration-200 ${
                  active
                    ? "bg-accent-soft font-medium text-accent-text"
                    : "text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line p-3">
        <p className="px-3 text-meta text-ink-faint">
          Middlemen never DM first.
        </p>
      </div>
    </nav>
  );
}
