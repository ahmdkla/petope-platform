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
const PROTECTED = ['/dashboard', '/deals', '/listings/new', '/settings'];

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
