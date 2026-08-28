import type { Metadata } from "next";
import Link from "next/link";
import { ShieldBan, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, EmptyState, Note } from "@/components/ui";

export const metadata: Metadata = {
  title: "Blacklist — EXSAVERSE",
  description: "Accounts blacklisted from EXSAVERSE, with the recorded reason.",
};

export const dynamic = "force-dynamic";

export default async function BlacklistPage() {
  /**
   * Only accounts an admin actually blacklisted after review.
   *
   * Pending and dismissed reports never appear here. Naming someone publicly
   * before a decision would make the platform the publisher of an unverified
   * accusation — the same harm the impersonation work exists to reduce.
   */
  const blacklisted = await db.user.findMany({
    where: { status: "BLACKLISTED" },
    select: {
      id: true,
      displayName: true,
      discordUsername: true,
      blacklistReason: true,
      blacklistedAt: true,
    },
    orderBy: { blacklistedAt: "desc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Blacklist"
        description="Accounts removed from EXSAVERSE after a reviewed report."
        actions={
          <Link
            href="/report"
            className="inline-flex h-field items-center gap-2 rounded-md border border-line bg-raised px-4 text-body font-medium text-ink transition-colors duration-200 hover:border-line-strong"
          >
            <ShieldAlert aria-hidden className="size-[18px]" strokeWidth={1.75} />
            Report someone
          </Link>
        }
      />

      <PageBody>
        <div className="max-w-3xl space-y-6">
          <Note>
            Every entry here was reviewed by an admin before it was published.
            Reports under review are not listed — an accusation is not a finding.
          </Note>

          {blacklisted.length === 0 ? (
            <EmptyState
              icon={ShieldBan}
              message="Nobody is blacklisted. Accounts appear here only after a report is upheld."
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card shadow-card">
              {blacklisted.map((u) => (
                <li key={u.id} className="flex items-start gap-4 p-5">
                  <Avatar name={u.displayName ?? "??"} seed={u.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-body font-semibold text-ink">
                        {u.displayName ?? "unnamed"}
                      </span>
                      {u.discordUsername ? (
                        <span className="font-mono text-meta text-ink-faint">
                          {u.discordUsername}
                        </span>
                      ) : null}
                      <Badge tone="danger">Blacklisted</Badge>
                    </div>
                    <p className="mt-1.5 text-body text-ink-muted">
                      {u.blacklistReason ?? "No reason recorded."}
                    </p>
                    {u.blacklistedAt ? (
                      <p className="mt-1 font-mono text-meta text-ink-faint">
                        {u.blacklistedAt.toISOString().slice(0, 10)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}
