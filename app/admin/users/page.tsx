import type { Metadata } from "next";
import { Users, TriangleAlert } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { findAltFlags } from "@/lib/alt-accounts";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, EmptyState, Input, Note, SectionTitle } from "@/components/ui";
import { UserRow } from "./user-row";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const actor = await getCurrentUser();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { discordUsername: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, flags] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        isVerifiedMm: true,
        blacklistReason: true,
        createdAt: true,
        _count: { select: { buyerDeals: true, sellerDeals: true, middlemanDeals: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 60,
    }),
    findAltFlags(),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Users"
        description="Search accounts, assign roles, and blacklist with a recorded reason."
      />

      <PageBody>
        <div className="max-w-4xl space-y-8">
          {flags.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle>Alt-account flags</SectionTitle>
              <Note>
                Accounts sharing a wallet, IP or device. These are signals, not
                findings — a shared IP can be a household. Never public, and
                never act on one without looking first.
              </Note>
              <ul className="space-y-2">
                {flags.map((f, i) => (
                  <li
                    key={`${f.kind}-${i}`}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-warn/25 bg-warn-soft p-3.5"
                  >
                    <TriangleAlert
                      aria-hidden
                      className="size-4 shrink-0 text-warn"
                      strokeWidth={2}
                    />
                    <Badge tone="warn">shared {f.kind}</Badge>
                    <span className="font-mono text-meta text-warn">{f.value}</span>
                    <span className="font-mono text-meta text-ink-muted">
                      {f.handles.join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Accounts</SectionTitle>
              <form className="w-64">
                <label htmlFor="q" className="sr-only">
                  Search accounts
                </label>
                <Input
                  id="q"
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Search name or email"
                />
              </form>
            </div>

            {users.length === 0 ? (
              <EmptyState
                icon={Users}
                message="No accounts match that search. Search by display name or email, or clear the field to list everyone."
              />
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card shadow-card">
                {users.map((u) => (
                  <li key={u.id} className="p-5">
                    <div className="flex flex-wrap items-start gap-4">
                      <Avatar name={u.displayName ?? "??"} seed={u.id} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-body font-semibold text-ink">
                            {u.displayName ?? "unnamed"}
                          </span>
                          <Badge tone={u.status === "BLACKLISTED" ? "danger" : "neutral"}>
                            {u.role.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                          {u.status !== "ACTIVE" ? (
                            <Badge tone="danger">{u.status.toLowerCase()}</Badge>
                          ) : null}
                          {u.isVerifiedMm ? <Badge tone="accent">Verified</Badge> : null}
                        </div>
                        <p className="mt-1 font-mono text-meta text-ink-faint">{u.email}</p>
                        <p className="mt-0.5 text-meta text-ink-faint">
                          {u._count.buyerDeals + u._count.sellerDeals} deals ·{" "}
                          {u._count.middlemanDeals} secured · joined{" "}
                          {u.createdAt.toISOString().slice(0, 10)}
                        </p>
                        {u.blacklistReason ? (
                          <p className="mt-1.5 text-meta text-danger">
                            {u.blacklistReason}
                          </p>
                        ) : null}
                      </div>

                      <UserRow
                        userId={u.id}
                        name={u.displayName ?? "this account"}
                        role={u.role}
                        blacklisted={u.status === "BLACKLISTED"}
                        isSelf={u.id === actor?.id}
                        actorRole={actor?.role ?? "USER"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PageBody>
    </AppShell>
  );
}
