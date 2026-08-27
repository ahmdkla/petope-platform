import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { Store, BadgeCheck } from "lucide-react";
import { formatMoney, resolveTotal } from "@/lib/money";

export const metadata: Metadata = { title: "Member — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      displayName: true,
      role: true,
      status: true,
      isVerifiedMm: true,
      workingHoursUtc: true,
      tradesSecured: true,
      createdAt: true,
      _count: { select: { vouchesReceived: true } },
      listings: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!user) notFound();

  const isMm = user.role === "MIDDLEMAN" || user.role === "MAIN_MIDDLEMAN";

  return (
    <AppShell>
      <PageHeader
        title={user.displayName ?? "Member"}
        description={
          isMm
            ? "Middleman profile. Verify this handle against the roster before acting on any message."
            : "Public member profile."
        }
        actions={
          <div className="flex items-center gap-2">
            <Avatar name={user.displayName ?? "??"} seed={id} size="lg" />
            {user.isVerifiedMm ? (
              <Badge tone="accent">
                <BadgeCheck aria-hidden className="size-3.5" strokeWidth={2} />
                Verified MM
              </Badge>
            ) : null}
            {user.status !== "ACTIVE" ? (
              <Badge tone="danger">{user.status.toLowerCase()}</Badge>
            ) : null}
          </div>
        }
      />

      <PageBody>
        <div className="grid max-w-4xl gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="space-y-3">
            <SectionTitle>Details</SectionTitle>
            <dl className="divide-y divide-line text-body">
              <Row label="Member since" value={user.createdAt.toISOString().slice(0, 10)} mono />
              {isMm ? (
                <>
                  <Row label="Working hours" value={user.workingHoursUtc ?? "not published"} mono />
                  <Row
                    label="Trades secured"
                    value={user.tradesSecured.toLocaleString("en-US")}
                    mono
                  />
                  <Row
                    label="Vouches"
                    value={user._count.vouchesReceived.toLocaleString("en-US")}
                    mono
                  />
                </>
              ) : null}
            </dl>
          </Card>

          <section>
            <SectionTitle className="mb-4">Active listings</SectionTitle>
            {user.listings.length === 0 ? (
              <EmptyState icon={Store} message="This member has no active listings." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line bg-card shadow-card">
                <table className="w-full border-collapse text-body">
                  <tbody>
                    {user.listings.map((l) => (
                      <tr
                        key={l.id}
                        className="h-row border-b border-line last:border-0 transition-colors duration-200 hover:bg-raised"
                      >
                        <td className="max-w-[16rem] truncate px-4 text-body text-ink">{l.item}</td>
                        <td className="px-4">
                          <Badge tone={l.side === "SELL" ? "sell" : "buy"}>
                            {l.side === "SELL" ? "Selling" : "Buying"}
                          </Badge>
                        </td>
                        <td className="px-4 text-body text-ink-muted">{l.chain}</td>
                        <td className="px-4 text-right font-mono tnum text-lead text-ink">
                          {formatMoney(
                            resolveTotal(l.price, l.priceType, l.quantity),
                            l.payment,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </PageBody>
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`truncate font-medium text-ink ${mono ? "font-mono tnum" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
