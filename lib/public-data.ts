import { unstable_cache } from 'next/cache';
import { db } from './db';

/**
 * Cached reads for the pages whose content does not depend on who is looking:
 * the roster, the vouch feed, the mint schedule and the blacklist.
 *
 * These cannot simply be `export const revalidate = 60` pages. Every page here
 * renders `<AppShell>`, which reads the session, and reading the session opts
 * the whole route into dynamic rendering — so the route-level knob has nothing
 * to act on. Caching the *queries* instead gets the intended effect: the
 * session stays per-request and correct, while the database work behind these
 * pages happens once a minute rather than once a visitor.
 *
 * Each entry carries a tag so a mutation can invalidate it immediately instead
 * of waiting out the window. `revalidateTag` calls live in the actions that
 * write the underlying rows.
 */

export const TAGS = {
  middlemen: 'public:middlemen',
  vouches: 'public:vouches',
  mints: 'public:mints',
  blacklist: 'public:blacklist',
} as const;

/** A minute. Long enough to absorb a burst, short enough that tags are a
 *  belt-and-braces rather than the only correctness mechanism. */
const TTL = 60;

/**
 * What `unstable_cache` ACTUALLY hands back.
 *
 * Its value round-trips through the cache store as JSON, so every `Date` comes
 * out the other side as an ISO **string** — while the function's inferred
 * return type still promises `Date`. That gap shipped three broken pages:
 * `/vouches` and `/blacklist` threw `toISOString is not a function`, and
 * `/mints` silently rendered "No mints are scheduled" because comparing a
 * string against a Date put every event in neither bucket. Nothing in
 * `tsc`, lint or the build could see it, because the types said `Date`.
 *
 * So the cached layer is typed honestly as `Serialized<T>`, and every exported
 * reader has to revive its dates to satisfy the compiler. The revive step is
 * now the only way to get a `Date` out of this file.
 */
type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

/** Narrow a cached result back to the shape the callers expect. */
function serialized<T>(value: T): Serialized<T> {
  return value as unknown as Serialized<T>;
}

export const getRoster = unstable_cache(
  async () =>
    db.user.findMany({
      where: { role: { in: ['MIDDLEMAN', 'MAIN_MIDDLEMAN'] }, status: 'ACTIVE' },
      select: {
        id: true,
        displayName: true,
        role: true,
        isVerifiedMm: true,
        workingHoursUtc: true,
        tradesSecured: true,
        _count: { select: { vouchesReceived: true } },
      },
      orderBy: [{ role: 'asc' }, { tradesSecured: 'desc' }],
    }),
  ['public-roster'],
  { revalidate: TTL, tags: [TAGS.middlemen] },
);

/**
 * The roster in the shape the vouch filter needs — same rows, fewer columns.
 * Kept separate so the two pages do not share a cache entry and one of them
 * silently over-fetches for the other.
 */
export const getVouchFilterRoster = unstable_cache(
  async () =>
    db.user.findMany({
      where: { role: { in: ['MIDDLEMAN', 'MAIN_MIDDLEMAN'] }, status: 'ACTIVE' },
      select: {
        id: true,
        displayName: true,
        isVerifiedMm: true,
        _count: { select: { vouchesReceived: true } },
      },
      orderBy: { displayName: 'asc' },
    }),
  ['public-vouch-roster'],
  { revalidate: TTL, tags: [TAGS.middlemen, TAGS.vouches] },
);

const cachedVouches = unstable_cache(
  async (middlemanId?: string) =>
    db.vouch.findMany({
      where: {
        ...(middlemanId ? { middlemanId } : {}),
        // Test-suite deals never surface publicly.
        deal: { isTest: false },
      },
      include: {
        author: { select: { id: true, displayName: true } },
        middleman: {
          select: {
            id: true,
            displayName: true,
            isVerifiedMm: true,
            workingHoursUtc: true,
          },
        },
        deal: { select: { projectName: true, reference: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
  ['public-vouches'],
  { revalidate: TTL, tags: [TAGS.vouches] },
);

export async function getVouches(middlemanId?: string) {
  const rows = serialized(await cachedVouches(middlemanId));
  // `createdAt` arrives as an ISO string from the cache; the UI needs a Date.
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

const cachedMintEvents = unstable_cache(
  async () =>
    db.mintEvent.findMany({
      include: { _count: { select: { deals: true } } },
      orderBy: { mintAt: 'asc' },
    }),
  ['public-mints'],
  { revalidate: TTL, tags: [TAGS.mints] },
);

export async function getMintEvents() {
  const rows = serialized(await cachedMintEvents());
  // Without this, `mintAt >= now` compares a string to a Date: it does not
  // throw, it just puts every event in neither the upcoming nor the past list,
  // and the page claims nothing is scheduled.
  return rows.map((r) => ({
    ...r,
    mintAt: new Date(r.mintAt),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  }));
}

const cachedBlacklist = unstable_cache(
  async () =>
    db.user.findMany({
      // isTest: the report suites blacklist throwaway accounts by design, and
      // this page names people publicly. Test debris must never reach it.
      where: { status: 'BLACKLISTED', isTest: false },
      select: {
        id: true,
        displayName: true,
        discordUsername: true,
        blacklistReason: true,
        blacklistedAt: true,
      },
      orderBy: { blacklistedAt: 'desc' },
    }),
  ['public-blacklist'],
  { revalidate: TTL, tags: [TAGS.blacklist] },
);

export async function getBlacklist() {
  const rows = serialized(await cachedBlacklist());
  return rows.map((r) => ({
    ...r,
    // Nullable: an account blacklisted before the column existed has none.
    blacklistedAt: r.blacklistedAt ? new Date(r.blacklistedAt) : null,
  }));
}
