import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui";
import { DealStatusPill } from "@/components/deal-status-pill";
import { Handshake } from "lucide-react";
import { formatMoney } from "@/lib/money";


export const metadata: Metadata = { title: "My deals — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/deals");

  const deals = await db.deal.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }, { middlemanId: user.id }] },
    include: {
      buyer: { select: { displayName: true } },
      seller: { select: { displayName: true } },
      middleman: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell>
      <PageHeader
        title="My deals"
        description="Every deal you are a party to, as buyer, seller, or assigned middleman."
      />
      <PageBody>
        {deals.length === 0 ? (
          <EmptyState
            icon={Handshake}
            message="You have no deals yet. Opening a deal from a listing creates one here."
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
          <div className="overflow-x-auto rounded-lg border border-line bg-card shadow-card">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <Th>Reference</Th>
                  <Th>Project</Th>
                  <Th>Status</Th>
                  <Th>Your role</Th>
                  <Th>Middleman</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const role =
                    d.buyerId === user.id
                      ? "Buyer"
                      : d.sellerId === user.id
                        ? "Seller"
                        : "Middleman";
                  return (
                    <tr
                      key={d.id}
                      className="h-row border-b border-line last:border-0 transition-colors duration-200 hover:bg-raised"
                    >
                      <td className="px-4">
                        <Link
                          href={`/deals/${d.id}`}
                          className="font-mono text-body font-medium text-accent-text underline underline-offset-2"
                        >
                          {d.reference}
                        </Link>
                      </td>
                      <td className="max-w-[16rem] truncate px-4 text-body text-ink">
                        {d.projectName}
                      </td>
                      <td className="px-4">
                        <DealStatusPill status={d.status} />
                      </td>
                      <td className="px-4 text-body text-ink-muted">{role}</td>
                      <td className="px-4 font-mono text-body text-ink-muted">
                        {d.middleman?.displayName ?? "unassigned"}
                      </td>
                      <td className="px-4 text-right font-mono tnum text-lead text-ink">
                        {formatMoney(d.dealAmount, d.asset)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`h-12 px-4 text-meta font-semibold uppercase tracking-wide text-ink-faint ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
