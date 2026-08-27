import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { assertDealParticipant } from "@/lib/deal-access";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Card, Note, SectionTitle } from "@/components/ui";
import { DealStatusPill } from "@/components/deal-status-pill";
import { formatMoney, describePriceType, formatAmount } from "@/lib/money";
import { DEAL_STATUS_LABEL, LIFECYCLE_ORDER, TERMINAL_STATES } from "@/lib/deal-meta";
import { LISTING_TYPE_LABEL } from "@/lib/listing-meta";

export const metadata: Metadata = { title: "Deal — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/deals/${id}`);

  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
      middleman: { select: { id: true, displayName: true, isVerifiedMm: true } },
      listing: { select: { id: true, type: true, projectLink: true } },
    },
  });
  if (!deal) notFound();

  // Permissions are per-deal, not global. One shared helper, never hand-rolled.
  const access = await assertDealParticipant(deal, user);
  if (!access.allowed) notFound();

  const stepIndex = LIFECYCLE_ORDER.indexOf(deal.status);
  const terminal = TERMINAL_STATES.includes(deal.status);

  return (
    <AppShell>
      <PageHeader
        title={deal.projectName}
        description={`Deal room ${deal.reference}`}
        actions={<DealStatusPill status={deal.status} />}
      />

      <PageBody>
        <div className="grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <Card className="space-y-3">
              <SectionTitle>Terms</SectionTitle>
              <dl className="divide-y divide-line text-body">
                <Row label="Project" value={deal.projectName} />
                <Row label="Project chain" value={deal.chain} />
                <Row label="Spot type" value={deal.specific} />
                <Row
                  label="Quantity"
                  value={`${deal.quantity} (${describePriceType(deal.priceType)})`}
                  mono
                />
                <Row
                  label="Deal amount"
                  value={formatMoney(deal.dealAmount, deal.asset)}
                  mono
                />
                <Row
                  label="MM fee"
                  value={
                    deal.mmFee === 0n
                      ? "set when a middleman claims"
                      : formatMoney(deal.mmFee, deal.asset)
                  }
                  mono={deal.mmFee !== 0n}
                />
                <Row
                  label="Collateral"
                  value={
                    deal.collateralAmount
                      ? formatAmount(deal.collateralAmount, deal.asset) + " " + deal.asset
                      : "none"
                  }
                  mono={Boolean(deal.collateralAmount)}
                />
                <Row
                  label="Escrow method"
                  value={
                    deal.method
                      ? deal.method.replace(/_/g, " ").toLowerCase()
                      : "not yet confirmed"
                  }
                />
              </dl>

              {!deal.method ? (
                <Note>
                  The escrow method is not set. The listing suggested{" "}
                  {deal.listing ? LISTING_TYPE_LABEL[deal.listing.type] : "no method"},
                  but both parties must confirm the exact flow with the middleman
                  before terms are locked.
                </Note>
              ) : null}
            </Card>

            <Card className="space-y-3">
              <SectionTitle>Parties</SectionTitle>
              <dl className="divide-y divide-line text-body">
                <Row label="Buyer" value={deal.buyer.displayName ?? "unnamed"} mono />
                <Row label="Seller" value={deal.seller.displayName ?? "unnamed"} mono />
                <Row
                  label="Middleman"
                  value={deal.middleman?.displayName ?? "unassigned"}
                  mono
                />
              </dl>
              {!deal.middleman ? (
                <Note>
                  No middleman has claimed this deal yet. Do not send any funds
                  until one has, and never act on a direct message — middlemen
                  never DM first.
                </Note>
              ) : null}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="space-y-3">
              <SectionTitle>Progress</SectionTitle>
              <ol className="space-y-2.5">
                {LIFECYCLE_ORDER.map((s, i) => {
                  const done = !terminal && stepIndex > i;
                  const current = deal.status === s;
                  return (
                    <li
                      key={s}
                      className={`flex items-center gap-2.5 text-body ${
                        current
                          ? "font-semibold text-ink"
                          : done
                            ? "text-ink-muted"
                            : "text-ink-faint"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`size-2.5 shrink-0 rounded-md ${
                          current ? "bg-accent" : done ? "bg-ok" : "bg-line-strong"
                        }`}
                      />
                      {DEAL_STATUS_LABEL[s]}
                    </li>
                  );
                })}
              </ol>
              {terminal ? (
                <p className="text-meta text-ink-faint">
                  This deal ended in {DEAL_STATUS_LABEL[deal.status].toLowerCase()}.
                </p>
              ) : null}
            </Card>

            <Note>
              The full deal room — chat, payment proofs and the middleman
              verification panel — is build-order step 3 and is not here yet.
            </Note>

            {deal.listing ? (
              <Link
                href="/listings"
                className="block text-body font-medium text-accent-text underline underline-offset-2"
              >
                Back to listings
              </Link>
            ) : null}
          </aside>
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
