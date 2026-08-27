import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { assertDealParticipant } from "@/lib/deal-access";

/**
 * Polling endpoint for the floating chat.
 *
 * No realtime service is installed, so the client polls. Every deal is access
 * checked individually through assertDealParticipant — the same helper the deal
 * room uses. A deal id in the query string proves nothing.
 *
 * `audit: false`: this is a background poll, not someone opening a room, and an
 * admin polling would otherwise write an audit row every few seconds.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ rooms: [] }, { status: 401 });

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;

  // Every non-terminal deal this user is a party to.
  const deals = await db.deal.findMany({
    where: {
      OR: [{ buyerId: user.id }, { sellerId: user.id }, { middlemanId: user.id }],
      status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] },
      isTest: false,
    },
    select: {
      id: true,
      reference: true,
      projectName: true,
      status: true,
      buyerId: true,
      sellerId: true,
      middlemanId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const rooms = [];
  for (const deal of deals) {
    const access = await assertDealParticipant(deal, user, { audit: false });
    if (!access.allowed) continue;

    const messages = await db.dealMessage.findMany({
      where: { dealId: deal.id },
      include: { author: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Unread = messages from someone else since the client last looked.
    const unread = sinceDate
      ? messages.filter((m) => m.createdAt > sinceDate && m.authorId !== user.id).length
      : 0;

    rooms.push({
      dealId: deal.id,
      reference: deal.reference,
      projectName: deal.projectName,
      status: deal.status,
      unread,
      messages: messages
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          body: m.body,
          kind: m.kind,
          authorId: m.authorId,
          authorName: m.author?.displayName ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
    });
  }

  return NextResponse.json({ rooms, serverTime: new Date().toISOString() });
}
