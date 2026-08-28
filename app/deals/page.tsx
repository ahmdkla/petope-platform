import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui";
import { DealList, type DealRow } from "./deal-list";
import { Handshake } from "lucide-react";
import type { SettlementAsset } from "@/lib/money";

export const metadata: Metadata = { title: "My deals" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  buyer: "As buyer",
  seller: "As seller",
  middleman: "As middleman",
};

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/deals");

  const { role: roleFilter } = await searchParams;

  const scope =
    roleFilter === "buyer"
      ? { buyerId: user.id }
      : roleFilter === "seller"
        ? { sellerId: user.id }
        : roleFilter === "middleman"
          ? { middlemanId: user.id }
          : { OR: [{ buyerId: user.id }, { sellerId: user.id }, { middlemanId: user.id }] };

  const deals = await db.deal.findMany({
    where: { ...scope, isTest: false },
    include: {
      buyer: { select: { displayName: true } },
      seller: { select: { displayName: true } },
      middleman: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rows: DealRow[] = deals.map((d) => ({
    id: d.id,
    reference: d.reference,
    projectName: d.projectName,
    status: d.status,
    role:
      d.buyerId === user.id ? "Buyer" : d.sellerId === user.id ? "Seller" : "Middleman",
    middlemanName: d.middleman?.displayName ?? "unassigned",
    amount: d.dealAmount,
    asset: d.asset as SettlementAsset,
  }));

  return (
    <AppShell>
      <PageHeader
        title={ROLE_LABEL[roleFilter ?? ""] ?? "My deals"}
        description={
          roleFilter
            ? `Deals where you are the ${roleFilter}.`
            : "Every deal you are a party to, as buyer, seller, or assigned middleman."
        }
      />
      <PageBody>
        {rows.length === 0 ? (
          <EmptyState
            icon={Handshake}
            message={
              roleFilter
                ? `You have no deals as ${roleFilter}. One appears here the moment a deal room opens with you in that role.`
                : "You have no deals yet. Opening a deal from a listing creates a room here with a middleman assigned."
            }
            action={
              <Link
                href="/listings"
                className="text-body font-medium text-accent-text underline underline-offset-2"
              >
                Browse listings
              </Link>
            }
          />
        ) : (
          <DealList rows={rows} />
        )}
      </PageBody>
    </AppShell>
  );
}
