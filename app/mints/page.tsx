import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { getMintEvents } from "@/lib/public-data";
import { getCurrentUser, isMiddleman } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Badge, Card, EmptyState, Note, SectionTitle } from "@/components/ui";
import { MintAdmin, RescheduleButton } from "./mint-admin";

export const metadata: Metadata = {
  title: "Mint schedule",
  description: "Upcoming project mints. Deals link here, and release timers depend on these dates.",
};

export const dynamic = "force-dynamic";

export default async function MintsPage() {
  const user = await getCurrentUser();
  const canEdit = user ? isMiddleman(user.role) : false;

  const events = await getMintEvents();

  const now = new Date();
  const upcoming = events.filter((e) => e.mintAt >= now);
  const past = events.filter((e) => e.mintAt < now);

  return (
    <AppShell>
      <PageHeader
        title="Mint schedule"
        description="When projects mint. Deals link to an entry here, and the release timers run from it."
      />

      <PageBody>
        <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-8">
            <section className="space-y-4">
              <SectionTitle>Upcoming</SectionTitle>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  message="No mints are scheduled. Middlemen and admins add a project here as soon as it announces a date, and any deal linked to it picks up the schedule."
                />
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((e) => (
                    <MintRow key={e.id} event={e} canEdit={canEdit} />
                  ))}
                </ul>
              )}
            </section>

            {past.length > 0 ? (
              <section className="space-y-4">
                <SectionTitle>Passed</SectionTitle>
                <ul className="space-y-3">
                  {past.slice(0, 15).map((e) => (
                    <MintRow key={e.id} event={e} canEdit={canEdit} past />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            {canEdit ? <MintAdmin /> : null}

            <Card className="space-y-2.5">
              <SectionTitle>When a project delays</SectionTitle>
              <p className="text-meta text-ink-muted">
                Change the date here once and every linked deal that has not
                started its release timers follows.
              </p>
              <p className="text-meta text-ink-muted">
                Deals already counting down keep their deadlines. Those were
                fixed when the timer started, and moving them afterwards would
                extend a window someone is relying on.
              </p>
            </Card>

            {!canEdit ? (
              <Note>
                Only middlemen and admins can add or change entries.
              </Note>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </AppShell>
  );
}

function MintRow({
  event,
  canEdit,
  past,
}: {
  event: {
    id: string;
    projectName: string;
    chain: string;
    mintAt: Date;
    note: string | null;
    projectLink: string | null;
    _count: { deals: number };
  };
  canEdit: boolean;
  past?: boolean;
}) {
  const iso = event.mintAt.toISOString();
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-card p-5 shadow-card">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lead font-semibold text-ink">{event.projectName}</h3>
          <Badge tone="neutral">{event.chain}</Badge>
          {event._count.deals > 0 ? (
            <Badge tone="info">
              {event._count.deals} {event._count.deals === 1 ? "deal" : "deals"}
            </Badge>
          ) : null}
          {past ? <Badge tone="neutral">Passed</Badge> : null}
        </div>

        <p className="mt-1.5 font-mono tnum text-body text-ink">
          {iso.replace("T", " ").slice(0, 16)} UTC
        </p>

        {event.note ? (
          <p className="mt-1.5 text-meta text-ink-muted">{event.note}</p>
        ) : null}

        {event.projectLink ? (
          <a
            href={event.projectLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex text-meta font-medium text-accent-text underline underline-offset-2"
          >
            Project link
          </a>
        ) : null}
      </div>

      {canEdit ? (
        <RescheduleButton
          eventId={event.id}
          projectName={event.projectName}
          currentIso={iso.slice(0, 16)}
          linkedDeals={event._count.deals}
        />
      ) : null}
    </li>
  );
}
