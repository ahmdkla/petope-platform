import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { assertDealParticipant } from "@/lib/deal-access";
import { AppShell, PageHeader } from "@/components/shell/app-shell";
import { DealStatusPill } from "@/components/deal-status-pill";
import { availableTransitions, type ActorRole } from "@/lib/deal-transitions";
import { TermsCard } from "./terms-card";
import { Participants } from "./participants";
import { StatusTimeline } from "./status-timeline";
import { DealChat } from "./deal-chat";
import { ActionPanel } from "./action-panel";
import { MethodConfirmation } from "./method-confirmation";
import { ProofPanel, type ProofView, type RequiredProof } from "./proof-panel";
import {
  DEAL_METHOD_RULES,
  PROOF_KIND_LABEL,
  PROOF_SUBMITTER,
  buyerTotal,
  isPrivateDataHandover,
  requiredProofKinds,
  requiredReleaseProofKinds,
  requiredRefundProofKinds,
} from "@/lib/deal-methods";
import { DeliveryPanel } from "./delivery-panel";
import { VouchPanel } from "./vouch-panel";
import { getListingDemand } from "@/lib/listing-demand";
import { getMmFeeConfig } from "@/lib/admin-settings";
import { DemandLine } from "@/components/fee-breakdown";
import { Card, Caution, SectionTitle } from "@/components/ui";
import { TimersCard, type TimerView } from "./timers-card";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Deal room — EXSAVERSE" };
export const dynamic = "force-dynamic";

export default async function DealRoomPage({
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
      buyer: { select: { id: true, displayName: true, isVerifiedMm: true, role: true } },
      seller: { select: { id: true, displayName: true, isVerifiedMm: true, role: true } },
      middleman: {
        select: {
          id: true,
          displayName: true,
          isVerifiedMm: true,
          role: true,
          workingHoursUtc: true,
          tradesSecured: true,
        },
      },
      listing: { select: { id: true, type: true, projectLink: true } },
    },
  });
  if (!deal) notFound();

  // A deal room contains exactly buyer, seller, assigned middleman and the bot.
  // Admin access is permitted but writes an AUDIT_ACCESS ledger row.
  const access = await assertDealParticipant(deal, user);
  if (!access.allowed) notFound();
  const role: ActorRole = access.role;

  const proofRows = await db.paymentProof.findMany({
    where: { dealId: id },
    include: {
      submittedBy: { select: { displayName: true } },
      verifiedBy: { select: { displayName: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const stamp = (d: Date | null) =>
    d ? d.toISOString().replace("T", " ").slice(0, 16) + " UTC" : null;

  // BigInt and Date cannot cross into a client component — flatten here.
  const proofs: ProofView[] = proofRows.map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status,
    reference: p.reference,
    claimedAmount:
      p.claimedAmount !== null && p.claimedAsset !== null
        ? formatMoney(p.claimedAmount, p.claimedAsset)
        : null,
    claimedAsset: p.claimedAsset,
    screenshotUrl: p.screenshotUrl,
    submittedAt: stamp(p.submittedAt)!,
    submittedById: p.submittedById,
    submittedByName: p.submittedBy.displayName,
    verifiedAt: stamp(p.verifiedAt),
    verifiedByName: p.verifiedBy?.displayName ?? null,
    verifierNote: p.verifierNote,
  }));

  const hasCollateral = (deal.collateralAmount ?? 0n) > 0n;

  // Competing demand on the source listing. Spots reserve only at funding, so
  // the buyer needs to know before paying whether they are in a race.
  const demand = deal.listingId ? await getListingDemand(deal.listingId) : null;
  const feeConfig = await getMmFeeConfig();

  // Only asked for on a completed deal, so the query is skipped otherwise.
  const existingVouch =
    deal.status === "COMPLETED"
      ? await db.vouch.findFirst({
          where: { dealId: deal.id, authorId: user.id },
          select: { id: true },
        })
      : null;

  // Which proofs matter depends on the phase, and comes from the method config.
  const activeKinds = !deal.method
    ? []
    : deal.status === "DISPUTED"
      ? requiredRefundProofKinds(deal.method, hasCollateral)
      : ["AWAITING_CONFIRMATION", "COMPLETED"].includes(deal.status)
        ? [
            ...requiredProofKinds(deal.method),
            ...requiredReleaseProofKinds(deal.method, hasCollateral),
          ]
        : requiredProofKinds(deal.method);

  const required: RequiredProof[] = deal.method
    ? activeKinds.map((kind) => ({
        kind,
        label: PROOF_KIND_LABEL[kind],
        submitter: PROOF_SUBMITTER[kind],
        expectedAmount:
          kind === "BUYER_PAYMENT"
            ? formatMoney(
                buyerTotal(deal.method!, {
                  dealAmount: deal.dealAmount,
                  mmFee: deal.mmFee,
                  mintPrice: deal.mintPrice,
                }),
                deal.asset,
              )
            : kind === "SELLER_COLLATERAL" || kind === "MM_COLLATERAL_RETURN"
            ? deal.collateralAmount
              ? formatMoney(deal.collateralAmount, deal.asset)
              : null
            : kind === "MM_RELEASE"
              ? formatMoney(deal.dealAmount, deal.asset)
              : kind === "MM_REFUND"
                ? formatMoney(
                    buyerTotal(deal.method!, {
                      dealAmount: deal.dealAmount,
                      mmFee: deal.mmFee,
                      mintPrice: deal.mintPrice,
                    }),
                    deal.asset,
                  )
                : null,
      }))
    : [];

  // Absolute deadlines, resolved server-side when the timer started.
  const timers: TimerView[] = [];
  if (deal.status === "AWAITING_CONFIRMATION" && deal.method) {
    const rule = DEAL_METHOD_RULES[deal.method];
    if (deal.sellerDeliveryDeadline) {
      timers.push({
        key: "seller",
        label: "Seller delivery deadline",
        deadlineIso: deal.sellerDeliveryDeadline.toISOString(),
        consequence: `If the seller has not delivered by then, the deal fails and the buyer is owed all funds. Window: ${rule.sellerDeliveryDeadlineHours}h after mint.`,
      });
    }
    if (deal.buyerConfirmDeadline) {
      timers.push({
        key: "buyerConfirm",
        label: "Buyer confirmation window",
        deadlineIso: deal.buyerConfirmDeadline.toISOString(),
        consequence: `The buyer has ${rule.buyerConfirmWindowHours}h to confirm receipt. After that the middleman may proceed without them.`,
      });
    }
    if (deal.autoReleaseAt) {
      timers.push({
        key: "autoRelease",
        label: "Buyer response window",
        deadlineIso: deal.autoReleaseAt.toISOString(),
        consequence: `After ${rule.buyerSilenceAutoReleaseHours}h of silence the buyer's confirmation is no longer required. The middleman still performs the release manually.`,
      });
    }
  }

  const messages = await db.dealMessage.findMany({
    where: { dealId: id },
    include: { author: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  // Flatten before crossing into the client: the rules carry guard and
  // systemMessage functions, which cannot be serialized.
  const actions = availableTransitions({ deal, role }).map(({ rule, blockedReason }) => ({
    id: rule.id,
    label: rule.label,
    description: rule.description,
    destructive: Boolean(rule.destructive),
    blockedReason,
  }));

  return (
    <AppShell>
      <PageHeader
        title={deal.projectName}
        description="Deal room"
        reference={deal.reference}
        actions={<DealStatusPill status={deal.status} />}
      />

      {/* Two panes: the conversation and terms lead, deal state sits alongside. */}
      <div className="grid gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <TermsCard deal={deal} role={role} />

          {deal.status === "CLAIMED" ? (
            <MethodConfirmation deal={deal} role={role} feeConfig={feeConfig} />
          ) : null}

          {demand && ["AWAITING_PAYMENT", "OPEN", "CLAIMED", "TERMS_LOCKED"].includes(deal.status) ? (
            <Card className="space-y-3">
              <SectionTitle>Listing supply</SectionTitle>
              <DemandLine
                quantityRemaining={demand.quantityRemaining}
                activeDeals={demand.activeDeals}
                oversubscribed={demand.oversubscribed}
              />
              <p className="text-meta text-ink-muted">
                This deal is for{" "}
                <span className="font-mono tnum text-ink">{deal.quantity}</span>{" "}
                {deal.quantity === 1 ? "spot" : "spots"}. Spots are reserved only
                when a deal is funded.
              </p>
              {demand.oversubscribed && deal.status === "AWAITING_PAYMENT" ? (
                <Caution>
                  {demand.spotsInFlight} spots are claimed across{" "}
                  {demand.activeDeals} open deals, but only{" "}
                  {demand.quantityRemaining} remain. Whoever funds first gets
                  them. If someone else funds before you, the middleman will
                  refuse this deal and refund you rather than overselling.
                </Caution>
              ) : null}
            </Card>
          ) : null}

          {deal.status === "COMPLETED" && deal.middleman ? (
            <VouchPanel
              dealId={deal.id}
              role={role}
              middlemanName={deal.middleman.displayName ?? "the middleman"}
              alreadyVouched={Boolean(existingVouch)}
            />
          ) : null}

          <DeliveryPanel
            deal={deal}
            role={role}
            privateData={deal.method ? isPrivateDataHandover(deal.method) : false}
          />

          {required.length > 0 &&
          [
            "AWAITING_PAYMENT",
            "FUNDED",
            "DELIVERING",
            "AWAITING_MINT",
            "AWAITING_CONFIRMATION",
            "COMPLETED",
            "DISPUTED",
            "REFUNDED",
          ].includes(deal.status) ? (
            <ProofPanel
              dealId={deal.id}
              role={role}
              asset={deal.asset}
              proofs={proofs}
              required={required}
              currentUserId={user.id}
              open={["AWAITING_PAYMENT", "AWAITING_CONFIRMATION", "DISPUTED"].includes(
                deal.status,
              )}
            />
          ) : null}

          <DealChat
            dealId={deal.id}
            messages={messages}
            currentUserId={user.id}
            currentUserName={user.displayName}
            readOnly={["COMPLETED", "CANCELLED", "REFUNDED"].includes(deal.status)}
          />
        </div>

        <aside className="space-y-6">
          <ActionPanel dealId={deal.id} items={actions} role={role} />
          <TimersCard timers={timers} paused={Boolean(deal.timersPausedAt)} />
          <StatusTimeline deal={deal} />
          <Participants deal={deal} viewerRole={role} />
        </aside>
      </div>
    </AppShell>
  );
}
