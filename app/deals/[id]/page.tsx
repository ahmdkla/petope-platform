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
