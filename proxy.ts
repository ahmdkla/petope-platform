import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Next.js 16 replaces `middleware.ts` with `proxy.ts`, which ALWAYS runs on the
 * Node.js runtime — so the session can be validated against the database rather
 * than by reading the cookie. (A `runtime` segment export is rejected here for
 * exactly that reason: there is nothing to choose.)
 *
 * That distinction matters for this product: Better Auth's `getSessionCookie()`
 * is an optimistic cookie check its own docs mark as NOT secure. A blacklisted
 * user would still hold a valid-looking cookie. Hitting the database is the
 * whole reason Better Auth was chosen, so do not "optimise" this back into a
 * cookie read.
 */

/** Routes that require a signed-in, non-blacklisted account. */
const PROTECTED = ['/deals', '/listings/new', '/profile', '/queue', '/admin'];

/**
 * Routes that additionally require a role, checked HERE rather than only in a
 * layout.
 *
 * `redirect()` inside `app/admin/layout.tsx` does not stop the page beneath it
 * from rendering: in the App Router a layout and its child render together, and
 * the response still carries the child's RSC payload. Measured on this app, a
 * plain USER requesting /admin/settings received a 307 whose body held 14KB of
 * rendered admin data including the fee configuration — and once any Suspense
 * boundary exists above the segment (a `loading.tsx` is enough), the redirect
 * degrades to a 200 and the full page streams out.
 *
 * The proxy runs before any of that, so a rejection here is a rejection before
 * a single row is read. The layout check stays as defence in depth.
 */
const ROLE_GATED: { prefix: string; roles: string[] }[] = [
  { prefix: '/admin', roles: ['ADMIN', 'MAIN_MIDDLEMAN'] },
  { prefix: '/queue', roles: ['MIDDLEMAN', 'MAIN_MIDDLEMAN', 'ADMIN'] },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // A suspended or blacklisted account is rejected on the very next request,
  // not whenever a token happens to expire. This is the behaviour a JWT-only
  // credentials flow could not provide.
  const status = (session.user as { status?: string }).status;
  if (status === 'BLACKLISTED' || status === 'SUSPENDED') {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set('reason', 'account-unavailable');
    return NextResponse.redirect(url);
  }

  const gate = ROLE_GATED.find(
    (g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`),
  );
  if (gate) {
    const role = (session.user as { role?: string }).role ?? 'USER';
    if (!gate.roles.includes(role)) {
      // Home, not sign-in: they are signed in, just not entitled. Sending them
      // to a login form for a page they can never reach would be a lie.
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
