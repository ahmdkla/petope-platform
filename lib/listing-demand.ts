import { db } from './db';

/**
 * How much demand is chasing a listing's remaining supply.
 *
 * Deals do NOT reserve spots until funding, so several buyers can hold open
 * deals for the same spots and the first to pay wins. That makes
 * oversubscription an ordinary state rather than an error — it has to be
 * visible to buyers before they send money, not discovered afterwards.
 */
export type ListingDemand = {
  quantityRemaining: number;
  /** Deals on this listing that have not reached a terminal state. */
  activeDeals: number;
  /** Spots claimed by those deals. May exceed quantityRemaining. */
  spotsInFlight: number;
  /** True when more spots are claimed than exist. */
  oversubscribed: boolean;
};

/** Deals that no longer compete for supply. */
const TERMINAL = ['COMPLETED', 'CANCELLED', 'REFUNDED'] as const;

export async function getListingDemand(listingId: string): Promise<ListingDemand> {
  const [listing, deals] = await Promise.all([
    db.listing.findUnique({
      where: { id: listingId },
      select: { quantityRemaining: true },
    }),
    db.deal.findMany({
      where: {
        listingId,
        status: { notIn: [...TERMINAL] },
        // Funded deals have already taken their spots out of supply, so they
        // are no longer "in flight" competing for what is left.
        spotsReservedAt: null,
      },
      select: { quantity: true },
    }),
  ]);

  const quantityRemaining = listing?.quantityRemaining ?? 0;
  const spotsInFlight = deals.reduce((n, d) => n + d.quantity, 0);

  return {
    quantityRemaining,
    activeDeals: deals.length,
    spotsInFlight,
    oversubscribed: spotsInFlight > quantityRemaining,
  };
}

/** Batched form for the listings feed, which needs this for every card. */
export async function getListingDemandMap(
  listingIds: string[],
): Promise<Map<string, ListingDemand>> {
  if (listingIds.length === 0) return new Map();

  const [listings, deals] = await Promise.all([
    db.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, quantityRemaining: true },
    }),
    db.deal.findMany({
      where: {
        listingId: { in: listingIds },
        status: { notIn: [...TERMINAL] },
        spotsReservedAt: null,
      },
      select: { listingId: true, quantity: true },
    }),
  ]);

  const map = new Map<string, ListingDemand>();
  for (const l of listings) {
    map.set(l.id, {
      quantityRemaining: l.quantityRemaining,
      activeDeals: 0,
      spotsInFlight: 0,
      oversubscribed: false,
    });
  }
  for (const d of deals) {
    if (!d.listingId) continue;
    const entry = map.get(d.listingId);
    if (!entry) continue;
    entry.activeDeals += 1;
    entry.spotsInFlight += d.quantity;
  }
  for (const entry of map.values()) {
    entry.oversubscribed = entry.spotsInFlight > entry.quantityRemaining;
  }
  return map;
}
