"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { LinkProgress } from "./route-progress";

/**
 * A navigation link that responds on the click rather than on the response.
 *
 * `useLinkStatus` is pending from the moment the link is pressed until the new
 * route commits, and it only works inside a `<Link>` — hence the inner
 * component. Two things ride on it:
 *
 *   - the destination takes its active styling immediately, so pressing a nav
 *     item never looks like nothing happened
 *   - the top progress bar starts at the click, not once the server answers
 *
 * Without this the sidebar highlight moves only after the route resolves, which
 * on a slow page is exactly the window where the app reads as broken.
 */
function Inner({
  active,
  activeClass,
  idleClass,
  children,
}: {
  active: boolean;
  activeClass: string;
  idleClass: string;
  children: React.ReactNode;
}) {
  const { pending } = useLinkStatus();
  // Pending counts as active: it is where the user is going.
  const on = active || pending;

  return (
    <>
      <span
        className={`flex h-full w-full items-center gap-3 rounded-md px-3 transition-colors duration-200 ${
          on ? activeClass : idleClass
        }`}
      >
        {children}
      </span>
      <LinkProgress />
    </>
  );
}

export function NavLink({
  href,
  active,
  activeClass,
  idleClass,
  className = "",
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  activeClass: string;
  idleClass: string;
  className?: string;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      <Inner active={active} activeClass={activeClass} idleClass={idleClass}>
        {children}
      </Inner>
    </Link>
  );
}
