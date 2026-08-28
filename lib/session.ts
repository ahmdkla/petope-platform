import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from './auth';

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
};

/**
 * Reads the session server-side. Never trust a client-supplied user id.
 *
 * Wrapped in React's `cache()`, which dedupes by argument list for the lifetime
 * of ONE request. Without it a single page render hit the database for the same
 * session up to three times — the layout, the page, and `AppShell` each ask
 * independently, and none of them can see that the others already did. On a
 * remote Postgres that was ~40-70ms of pure duplicate latency each.
 *
 * This is per-request memoisation, not a cache with a TTL: a revoked or
 * blacklisted session is still rejected on the very next request, which is the
 * property database sessions were chosen for in the first place.
 *
 * `proxy.ts` runs before rendering, in its own context, so its check is a
 * separate lookup by design and cannot be shared.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const u = session.user as unknown as {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role?: string;
    status?: string;
  };

  return {
    id: u.id,
    email: u.email,
    displayName: u.name,
    avatarUrl: u.image,
    role: u.role ?? 'USER',
    status: u.status ?? 'ACTIVE',
  };
});

export function isMiddleman(role: string): boolean {
  return role === 'MIDDLEMAN' || role === 'MAIN_MIDDLEMAN' || role === 'ADMIN';
}
