import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareQuote, BadgeCheck } from "lucide-react";
import { getVouches, getVouchFilterRoster } from "@/lib/public-data";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, Card, EmptyState, Note, SectionTitle } from "@/components/ui";
import { isOnShift } from "@/lib/shifts";

export const metadata: Metadata = {
  title: "Vouches — EXSAVERSE",
  description: "Testimonials for EXSAVERSE middlemen, each tied to a completed deal.",
};

export const dynamic = "force-dynamic";

export default async function VouchesPage({
  searchParams,
}: {
  searchParams: Promise<{ mm?: string }>;
}) {
  const { mm } = await searchParams;

  const [vouches, middlemen] = await Promise.all([
    getVouches(mm),
    getVouchFilterRoster(),
  ]);

  const filtered = middlemen.find((m) => m.id === mm);

  return (
    <AppShell>
      <PageHeader
        title={filtered ? `Vouches for ${filtered.displayName}` : "Vouches"}
        description="Every vouch is tied to a deal that completed, written by the buyer or seller on it."
      />

      <PageBody>
        <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="space-y-4">
            {vouches.length === 0 ? (
              <EmptyState
                icon={MessageSquareQuote}
                message={
                  filtered
                    ? `Nobody has vouched for ${filtered.displayName} yet.`
                    : "No vouches yet. One appears here when a buyer or seller writes about a completed deal."
                }
                action={
                  filtered ? (
                    <Link
                      href="/vouches"
                      className="text-body font-medium text-accent-text underline underline-offset-2"
                    >
                      See all vouches
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              vouches.map((v) => (
                <Card key={v.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={v.middleman.displayName ?? "??"}
                      seed={v.middleman.id}
                      onShift={isOnShift(v.middleman.workingHoursUtc)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/vouches?mm=${v.middleman.id}`}
                          className="font-mono text-body font-semibold text-ink transition-opacity duration-200 hover:opacity-80"
                        >
                          {v.middleman.displayName ?? "unnamed"}
                        </Link>
                        {v.middleman.isVerifiedMm ? (
                          <Badge tone="accent">
                            <BadgeCheck aria-hidden className="size-3.5" strokeWidth={2} />
                            Verified
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-meta text-ink-faint">
                        secured {v.deal.projectName} for{" "}
                        <span className="font-mono">
                          {v.author.displayName ?? "a member"}
                        </span>
                      </p>
                    </div>
                    <time
                      dateTime={v.createdAt.toISOString()}
                      className="shrink-0 font-mono text-meta text-ink-faint"
                    >
                      {v.createdAt.toISOString().slice(0, 10)}
                    </time>
                  </div>

                  <p className="border-t border-line pt-3 text-body text-ink">
                    {v.body}
                  </p>
                </Card>
              ))
            )}
          </section>

          <aside className="space-y-4">
            <Card className="space-y-3">
              <SectionTitle>By middleman</SectionTitle>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/vouches"
                    className={`flex h-11 items-center justify-between rounded-md px-2.5 text-meta transition-colors duration-200 ${
                      mm ? "text-ink-muted hover:bg-raised" : "bg-raised font-medium text-ink"
                    }`}
                  >
                    Everyone
                  </Link>
                </li>
                {middlemen.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/vouches?mm=${m.id}`}
                      className={`flex h-11 items-center justify-between gap-2 rounded-md px-2.5 text-meta transition-colors duration-200 ${
                        mm === m.id
                          ? "bg-raised font-medium text-ink"
                          : "text-ink-muted hover:bg-raised"
                      }`}
                    >
                      <span className="truncate font-mono">{m.displayName}</span>
                      <span className="font-mono tnum text-ink-faint">
                        {m._count.vouchesReceived}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Note>
              Counts only — no average score. Ratings are optional on a vouch, so
              an average would be computed from partial data and would
              misrepresent middlemen.
            </Note>

            <Note>
              A vouch can only be written by the buyer or seller of a deal that
              completed, from inside that deal room. That is what stops them
              being manufactured.
            </Note>
          </aside>
        </div>
      </PageBody>
    </AppShell>
  );
}
