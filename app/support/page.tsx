import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, isMiddleman } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Badge, EmptyState, Note, SectionTitle } from "@/components/ui";
import { NewTicketButton } from "./new-ticket";
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUS_TONE,
} from "@/lib/report-meta";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/support");

  const staff = isMiddleman(user.role);

  const [mine, queue] = await Promise.all([
    db.supportTicket.findMany({
      where: { openedById: user.id },
      include: {
        assignedTo: { select: { displayName: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    staff
      ? db.supportTicket.findMany({
          where: { status: { in: ["OPEN", "ASSIGNED"] }, openedById: { not: user.id } },
          include: {
            openedBy: { select: { displayName: true } },
            assignedTo: { select: { displayName: true } },
            _count: { select: { messages: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Support"
        description="Talk to the team. Separate from a deal room, with no escrow attached."
        actions={<NewTicketButton />}
      />

      <PageBody>
        <div className="max-w-4xl space-y-8">
          <Note>
            Support rooms carry no escrow and no payment proofs. Never send funds
            or credentials here — a deal always happens in its own deal room.
          </Note>

          <section className="space-y-4">
            <SectionTitle>Your rooms</SectionTitle>
            {mine.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                message="You have no support rooms. Open one and the team will pick it up."
              />
            ) : (
              <ul className="space-y-3">
                {mine.map((t) => (
                  <TicketRow
                    key={t.id}
                    ticket={t}
                    assignedName={t.assignedTo?.displayName ?? null}
                    messages={t._count.messages}
                  />
                ))}
              </ul>
            )}
          </section>

          {staff ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionTitle>Team queue</SectionTitle>
                <Badge tone={queue.length > 0 ? "warn" : "neutral"}>
                  {queue.length} open
                </Badge>
              </div>
              {queue.length === 0 ? (
                <EmptyState
                  icon={LifeBuoy}
                  message="Nothing waiting. Rooms opened by members appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {queue.map((t) => (
                    <TicketRow
                      key={t.id}
                      ticket={t}
                      openedName={t.openedBy.displayName}
                      assignedName={t.assignedTo?.displayName ?? null}
                      messages={t._count.messages}
                    />
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </PageBody>
    </AppShell>
  );
}

function TicketRow({
  ticket,
  openedName,
  assignedName,
  messages,
}: {
  ticket: {
    id: string;
    reference: string;
    subject: string;
    category: keyof typeof SUPPORT_CATEGORY_LABEL;
    status: keyof typeof SUPPORT_STATUS_LABEL;
    updatedAt: Date;
  };
  openedName?: string | null;
  assignedName?: string | null;
  messages: number;
}) {
  return (
    <li>
      <Link
        href={`/support/${ticket.id}`}
        className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-card p-5 shadow-card transition-colors duration-200 hover:border-line-strong"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-meta text-accent-text">{ticket.reference}</span>
            <Badge tone={SUPPORT_STATUS_TONE[ticket.status]}>
              {SUPPORT_STATUS_LABEL[ticket.status]}
            </Badge>
            <Badge tone="neutral">{SUPPORT_CATEGORY_LABEL[ticket.category]}</Badge>
          </div>
          <p className="mt-1.5 truncate text-lead font-semibold text-ink">
            {ticket.subject}
          </p>
          <p className="mt-1 text-meta text-ink-faint">
            {openedName ? (
              <>
                opened by <span className="font-mono">{openedName}</span> ·{" "}
              </>
            ) : null}
            {assignedName ? (
              <>
                with <span className="font-mono">{assignedName}</span> ·{" "}
              </>
            ) : (
              "unassigned · "
            )}
            <span className="font-mono tnum">{messages}</span>{" "}
            {messages === 1 ? "message" : "messages"}
          </p>
        </div>
        <time
          dateTime={ticket.updatedAt.toISOString()}
          className="shrink-0 font-mono text-meta text-ink-faint"
        >
          {ticket.updatedAt.toISOString().slice(0, 10)}
        </time>
      </Link>
    </li>
  );
}
