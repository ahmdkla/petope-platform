import type { Metadata } from "next";
import { getRoster } from "@/lib/public-data";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import Link from "next/link";
import { Avatar, Badge, EmptyState } from "@/components/ui";
import {
  ShieldAlert,
  ShieldCheck,
  Clock3,
  Handshake,
  MessageSquareQuote,
} from "lucide-react";
import { shiftStatus, currentShiftWindow, isOnShift } from "@/lib/shifts";
import { HandleCheck } from "./handle-check";
import { CopyHandle } from "./copy-handle";

export const metadata: Metadata = {
  title: "Middleman roster",
  description:
    "The official list of EXSAVERSE middlemen. Anyone not on this list is not a middleman.",
};

// Public page, always current: a stale roster is an impersonation risk.
export const dynamic = "force-dynamic";

export default async function MiddlemenPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const onShiftOnly = filter === "on-shift";

  const middlemen = await getRoster();

  // Shift windows are absolute UTC, so this is deterministic server-side and
  // the same for every viewer. The page is already force-dynamic.
  const onShiftNow = middlemen.filter((m) => shiftStatus(m.workingHoursUtc).onShift).length;
  const shown = onShiftOnly
    ? middlemen.filter((m) => shiftStatus(m.workingHoursUtc).onShift)
    : middlemen;
  const shift = currentShiftWindow();
  // Checked against the FULL roster, not the filtered view: "is this person a
  // middleman" must not depend on whether they happen to be on shift.
  const handles = middlemen
    .map((m) => m.displayName)
    .filter((h): h is string => Boolean(h));

  return (
    <AppShell>
      <PageHeader
        title={onShiftOnly ? "On shift now" : "Middleman roster"}
        description={
          onShiftOnly
            ? `Middlemen covering the ${shift.label} shift. This page is the only authoritative list.`
            : "This page is the only authoritative list of EXSAVERSE middlemen."
        }
        actions={
          onShiftNow > 0 ? (
            <Badge tone="ok">
              {onShiftNow} on shift now
            </Badge>
          ) : null
        }
      />

      <PageBody>
        {/*
          The primary safeguard on this page, and now the only one — there is no
          verified badge to lean on. Weighted accordingly: danger rather than
          warning, a heading rather than a sentence in a strip, and the handle
          checker inside the same surface so the instruction and the tool to
          follow it are not separated.
        */}
        <section
          aria-labelledby="impersonation-warning"
          className="rounded-xl border border-danger/40 bg-danger-soft p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              aria-hidden
              className="mt-0.5 size-6 shrink-0 text-danger"
              strokeWidth={2}
            />
            <div className="min-w-0 space-y-2">
              <h2
                id="impersonation-warning"
                className="text-section font-bold tracking-tight text-danger"
              >
                A middleman will never message you first
              </h2>
              <p className="text-body text-ink">
                Anyone who does is an impersonator, whatever their handle or
                avatar looks like. This page is the only authoritative list:
                everyone on it is a middleman, and nobody else is. Compare the
                exact handle character for character before you send funds,
                credentials, or a wallet.
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-danger/25 pt-5">
            <HandleCheck roster={handles} />
          </div>
        </section>

        {shown.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={ShieldCheck}
              message={
                onShiftOnly
                  ? `Nobody is covering the ${shift.label} shift right now. Every middleman is still listed — clear the filter to see who is on later, or open a deal anyway and the next one on shift will claim it.`
                  : "No middlemen are listed yet. Middlemen appear here with their exact handle, vouch count, trades secured, and published hours."
              }
              action={
                onShiftOnly ? (
                  <Link
                    href="/middlemen"
                    className="text-body font-medium text-accent-text underline underline-offset-2"
                  >
                    Show all middlemen
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
            {shown.map((m) => (
              <article
                key={m.id}
                className="rounded-xl border border-line bg-card p-6 shadow-card transition-colors duration-200 hover:border-line-strong"
              >
                <div className="flex items-start gap-4">
                  <Avatar
                    name={m.displayName ?? "??"}
                    seed={m.id}
                    size="lg"
                    onShift={isOnShift(m.workingHoursUtc)}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-mono text-section font-semibold text-ink">
                      {m.displayName ?? "unnamed"}
                    </h2>
                    <p className="mt-1 text-meta text-ink-muted">
                      {m.role === "MAIN_MIDDLEMAN" ? "Main middleman" : "Middleman"}
                    </p>
                  </div>
                </div>

                {/* The exact handle, copyable. The heading above truncates on a
                    narrow card, and a truncated handle is precisely the thing
                    you cannot compare character for character. */}
                {m.displayName ? (
                  <div className="mt-4">
                    <p className="mb-1.5 text-meta text-ink-faint">Exact handle</p>
                    <CopyHandle handle={m.displayName} />
                  </div>
                ) : null}

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
