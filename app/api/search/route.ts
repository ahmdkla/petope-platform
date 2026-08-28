import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { shortReference } from "@/lib/reference";
import type { SearchHit } from "@/lib/search-types";

// Re-exported so existing importers keep working; the definition lives in a
// leaf module that never reaches for the database. See lib/search-types.ts.
export type { SearchHit } from "@/lib/search-types";

/**
 * Global search across listings, deals and middlemen.
 *
 * Deals are scoped to the caller: a deal room is private, so search must never
 * surface one the user is not a party to. Listings and middlemen are public.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) return NextResponse.json({ hits: [] });

  const like = { contains: q, mode: "insensitive" as const };

  const [listings, deals, middlemen] = await Promise.all([
    db.listing.findMany({
      where: {
        isTest: false,
        status: { in: ["ACTIVE", "SOLD_OUT"] },
        OR: [{ item: like }, { chain: like }],
      },
      take: 5,
      orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
    }),
    user
      ? db.deal.findMany({
          where: {
            isTest: false,
            // Scoped to the caller. A deal room is private.
            OR: [{ buyerId: user.id }, { sellerId: user.id }, { middlemanId: user.id }],
            AND: [{ OR: [{ projectName: like }, { reference: like }] }],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    db.user.findMany({
      where: {
        role: { in: ["MIDDLEMAN", "MAIN_MIDDLEMAN"] },
        status: "ACTIVE",
        OR: [{ displayName: like }, { discordUsername: like }],
      },
      take: 5,
      select: {
        id: true,
        displayName: true,
        isVerifiedMm: true,
        workingHoursUtc: true,
        tradesSecured: true,
      },
    }),
  ]);

  const hits: SearchHit[] = [
    ...listings.map((l) => ({
      kind: "listing" as const,
      id: l.id,
      href: `/listings?side=${l.side}&q=${encodeURIComponent(l.item)}`,
      title: l.item,
      subtitle: `${l.side === "SELL" ? "Selling" : "Buying"} · ${l.chain} · ${l.specific}`,
      meta: formatMoney(l.price, l.payment),
    })),
    ...deals.map((d) => ({
      kind: "deal" as const,
      id: d.id,
      href: `/deals/${d.id}`,
      title: d.projectName,
      subtitle: `${shortReference(d.reference)} · ${d.status.toLowerCase().replace(/_/g, " ")}`,
      meta: formatMoney(d.dealAmount, d.asset),
    })),
    ...middlemen.map((m) => ({
      kind: "middleman" as const,
      id: m.id,
      href: `/u/${m.id}`,
      title: m.displayName ?? "unnamed",
      subtitle: m.isVerifiedMm ? "Verified middleman" : "Middleman",
      meta: m.workingHoursUtc,
    })),
  ];

  return NextResponse.json({ hits });
}
