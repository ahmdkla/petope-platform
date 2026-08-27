import type { Metadata } from "next";
import { db } from "@/lib/db";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge } from "@/components/ui";
import { ShieldAlert, BadgeCheck, Clock3, Handshake, MessageSquareQuote } from "lucide-react";
import { shiftStatus } from "@/lib/shifts";

export const metadata: Metadata = {
  title: "Middleman roster — EXSAVERSE",
  description:
    "The official list of EXSAVERSE middlemen. Anyone not on this list is not a middleman.",
};

// Public page, always current: a stale roster is an impersonation risk.
export const dynamic = "force-dynamic";

export default async function MiddlemenPage() {
  const middlemen = await db.user.findMany({
    where: {
      role: { in: ["MIDDLEMAN", "MAIN_MIDDLEMAN"] },
      status: "ACTIVE",
    },
    select: {
      id: true,
      displayName: true,
      role: true,
      isVerifiedMm: true,
      workingHoursUtc: true,
      tradesSecured: true,
      _count: { select: { vouchesReceived: true } },
    },
    orderBy: [{ role: "asc" }, { tradesSecured: "desc" }],
  });

  // Shift windows are absolute UTC, so this is deterministic server-side and
  // the same for every viewer. The page is already force-dynamic.
  const onShiftNow = middlemen.filter((m) => shiftStatus(m.workingHoursUtc).onShift).length;

  return (
    <AppShell>
      <PageHeader
        title="Middleman roster"
        description="This page is the only authoritative list of EXSAVERSE middlemen."
        actions={
          onShiftNow > 0 ? (
            <Badge tone="ok">
              {onShiftNow} on shift now
            </Badge>
          ) : null
        }
      />

      <PageBody>
        <div className="flex max-w-3xl gap-3 rounded-lg border border-warn/25 bg-warn-soft p-4 text-body text-warn">
          <ShieldAlert aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
          <span>
            Middlemen never DM you first. If someone contacts you claiming to be
            staff, they are an impersonator. Verify the exact handle here before
            sending funds, credentials, or a wallet.
          </span>
        </div>

        {middlemen.length === 0 ? (
          <p className="mt-6 text-body text-ink-muted">
            No middlemen are listed yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {middlemen.map((m) => (
              <article
                key={m.id}
                className="rounded-xl border border-line bg-card p-6 shadow-card transition-colors duration-200 hover:border-line-strong"
              >
                <div className="flex items-start gap-4">
                  <Avatar
                    name={m.displayName ?? "??"}
                    seed={m.id}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-mono text-section font-semibold text-ink">
                      {m.displayName ?? "unnamed"}
                    </h2>
                    <p className="mt-1 text-meta text-ink-muted">
                      {m.role === "MAIN_MIDDLEMAN" ? "Main middleman" : "Middleman"}
                    </p>
                  </div>
                  {m.isVerifiedMm ? (
                    <Badge tone="accent">
                      <BadgeCheck aria-hidden className="size-3.5" strokeWidth={2} />
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Unverified</Badge>
                  )}
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                  <Trust
                    icon={Handshake}
                    label="Trades secured"
                    value={m.tradesSecured.toLocaleString("en-US")}
                  />
                  <Trust
                    icon={MessageSquareQuote}
                    label="Vouches"
                    value={m._count.vouchesReceived.toLocaleString("en-US")}
                  />
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <Clock3 aria-hidden className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                  <span className="font-mono text-meta text-ink-muted">
                    {m.workingHoursUtc ?? "hours not published"}
                  </span>
                  {(() => {
                    // Shifts are absolute UTC windows, so this is the same
                    // answer for every viewer.
                    const s = shiftStatus(m.workingHoursUtc);
                    return s.onShift ? (
                      <Badge tone="ok">{s.label}</Badge>
                    ) : m.workingHoursUtc ? (
                      <span className="text-meta text-ink-faint">{s.label}</span>
                    ) : null;
                  })()}
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-6 max-w-3xl text-meta text-ink-faint">
          Vouch counts are the number of published testimonials tied to a
          completed deal. No aggregate rating is shown.
        </p>
      </PageBody>
    </AppShell>
  );
}

function Trust({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Handshake;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-meta text-ink-faint">
        <Icon aria-hidden className="size-3.5" strokeWidth={2} />
        {label}
      </dt>
      <dd className="mt-1 font-mono tnum text-section font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}
