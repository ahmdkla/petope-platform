import type { Metadata } from "next";
import Link from "next/link";
import { ShieldBan, ShieldAlert } from "lucide-react";
import { getBlacklist } from "@/lib/public-data";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, EmptyState, Note } from "@/components/ui";

export const metadata: Metadata = {
  title: "Blacklist",
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
  const blacklisted = await getBlacklist();

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
        <div className="max-w-6xl space-y-6">
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
            /**
             * Two columns from `md` up. Each entry is a short, self-contained
             * record rather than a row to compare across, so the single column
             * was buying nothing and leaving half the page empty. Separate
             * cards rather than a divided list: dividers imply a shared reading
             * order down the page, which is wrong once entries sit side by side.
             */
            <ul className="grid gap-4 md:grid-cols-2">
              {blacklisted.map((u) => (
                <li
                  key={u.id}
                  className="flex min-w-0 items-start gap-4 rounded-lg border border-line bg-card p-5 shadow-card"
                >
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
