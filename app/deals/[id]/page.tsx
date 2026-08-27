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
  PROOF_KIND_LABEL,
  PROOF_SUBMITTER,
  buyerTotal,
  requiredProofKinds,
} from "@/lib/deal-methods";
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

  // Which proofs this method requires comes from the method config.
  const required: RequiredProof[] = deal.method
    ? requiredProofKinds(deal.method).map((kind) => ({
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
            : deal.collateralAmount
              ? formatMoney(deal.collateralAmount, deal.asset)
              : null,
      }))
    : [];

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
        description={`Deal room ${deal.reference}`}
        actions={<DealStatusPill status={deal.status} />}
      />

      {/* Two panes: the conversation and terms lead, deal state sits alongside. */}
      <div className="grid gap-8 px-8 py-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <TermsCard deal={deal} role={role} />

          {deal.status === "CLAIMED" ? (
            <MethodConfirmation deal={deal} role={role} />
          ) : null}

          {required.length > 0 &&
          ["AWAITING_PAYMENT", "FUNDED", "DELIVERING", "AWAITING_MINT", "AWAITING_CONFIRMATION", "COMPLETED", "DISPUTED", "REFUNDED"].includes(
            deal.status,
          ) ? (
            <ProofPanel
              dealId={deal.id}
              role={role}
              asset={deal.asset}
              proofs={proofs}
              required={required}
              currentUserId={user.id}
              open={deal.status === "AWAITING_PAYMENT"}
            />
          ) : null}

          <DealChat
            dealId={deal.id}
            messages={messages}
            currentUserId={user.id}
            readOnly={["COMPLETED", "CANCELLED", "REFUNDED"].includes(deal.status)}
          />
        </div>

        <aside className="space-y-6">
          <ActionPanel dealId={deal.id} items={actions} role={role} />
          <StatusTimeline deal={deal} />
          <Participants deal={deal} viewerRole={role} />
        </aside>
      </div>
    </AppShell>
  );
}
