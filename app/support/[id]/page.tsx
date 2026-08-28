import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, isMiddleman } from "@/lib/session";
import { assertSupportParticipant } from "@/lib/support-access";
import { AppShell, PageHeader } from "@/components/shell/app-shell";
import { Badge, Card, Note, SectionTitle } from "@/components/ui";
import { SupportThread } from "./support-thread";
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUS_TONE,
} from "@/lib/report-meta";

export const metadata: Metadata = { title: "Support room" };
export const dynamic = "force-dynamic";

export default async function SupportRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/support/${id}`);

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, displayName: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
  });
  if (!ticket) notFound();

  // The opener always; any middleman or admin may pick it up.
  const access = assertSupportParticipant(ticket, user);
  if (!access.allowed) notFound();

  const messages = await db.supportMessage.findMany({
    where: { ticketId: id },
    include: { author: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  return (
    <AppShell>
      <PageHeader
        title={ticket.subject}
        description="Support room"
        reference={ticket.reference}
        actions={
          <Badge tone={SUPPORT_STATUS_TONE[ticket.status]}>
            {SUPPORT_STATUS_LABEL[ticket.status]}
          </Badge>
        }
      />

      <div className="grid gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <SupportThread
          ticketId={ticket.id}
          messages={messages.map((m) => ({
            id: m.id,
            body: m.body,
            kind: m.kind,
            authorId: m.authorId,
            authorName: m.author?.displayName ?? null,
            createdAt: m.createdAt.toISOString(),
          }))}
          currentUserId={user.id}
          readOnly={ticket.status === "CLOSED"}
          isStaff={isMiddleman(user.role)}
          status={ticket.status}
        />

        <aside className="space-y-6">
          <Card className="space-y-3">
            <SectionTitle>Details</SectionTitle>
            <dl className="divide-y divide-line text-body">
              <Row label="Category" value={SUPPORT_CATEGORY_LABEL[ticket.category]} />
              <Row label="Opened by" value={ticket.openedBy.displayName ?? "unnamed"} mono />
              <Row
                label="Assigned to"
                value={ticket.assignedTo?.displayName ?? "unassigned"}
                mono
              />
              <Row
                label="Opened"
                value={ticket.createdAt.toISOString().slice(0, 10)}
                mono
              />
            </dl>
          </Card>

          <Note>
            No escrow here. A support room never handles funds, payment proofs,
            or credentials — those belong in a deal room, and never in a message.
          </Note>
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`truncate font-medium text-ink ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
