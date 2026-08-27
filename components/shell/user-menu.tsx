"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { Avatar } from "@/components/ui";
import { signOut } from "@/lib/auth-client";
import type { CurrentUser } from "@/lib/session";

const ROLE_LABEL: Record<string, string> = {
  USER: "Member",
  MIDDLEMAN: "Middleman",
  MAIN_MIDDLEMAN: "Main middleman",
  ADMIN: "Admin",
};

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-card px-2.5 text-body text-ink transition-colors duration-200 hover:border-line-strong"
      >
        <Avatar name={user.displayName ?? user.email} seed={user.id} size="sm" />
        <span className="font-mono">{user.displayName ?? user.email}</span>
        <ChevronDown aria-hidden className="size-4 text-ink-faint" strokeWidth={1.75} />
      </button>

      {open ? (
        // Shadow is allowed here: this is an overlay, and elevation is its job.
        <div
          role="menu"
          className="absolute right-0 top-13 z-40 w-64 rounded-lg border border-line bg-card py-1.5 shadow-overlay"
        >
          <div className="border-b border-line px-4 pb-3 pt-2">
            <p className="truncate font-mono text-body text-ink">{user.email}</p>
            <p className="mt-1 text-meta text-ink-faint">
              {ROLE_LABEL[user.role] ?? user.role}
            </p>
          </div>

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center gap-2.5 px-4 text-body text-ink-muted transition-colors duration-200 hover:bg-raised hover:text-ink"
          >
            <UserIcon aria-hidden className="size-4" strokeWidth={1.75} />
            Profile
          </Link>

          {/* Sign-out sits below a divider: separated from ordinary nav items. */}
          <div className="mt-1.5 border-t border-line pt-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={pending}
              className="flex h-11 w-full cursor-pointer items-center gap-2.5 px-4 text-left text-body text-ink-muted transition-colors duration-200 hover:bg-raised hover:text-ink disabled:opacity-50"
            >
              <LogOut aria-hidden className="size-4" strokeWidth={1.75} />
              {pending ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
