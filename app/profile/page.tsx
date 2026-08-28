import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Avatar, Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Profile — EXSAVERSE" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  USER: "Member",
  MIDDLEMAN: "Middleman",
  MAIN_MIDDLEMAN: "Main middleman",
  ADMIN: "Admin",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/profile");

  const [record, listingCount, dealCount, wallets] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        createdAt: true,
        termsAcceptedAt: true,
        isVerifiedMm: true,
        workingHoursUtc: true,
        tradesSecured: true,
        discordUsername: true,
        emailVerified: true,
      },
    }),
    db.listing.count({ where: { authorId: user.id, status: { in: ["ACTIVE", "SOLD_OUT"] } } }),
    db.deal.count({ where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] } }),
    db.userWallet.findMany({
      where: { userId: user.id },
      select: { id: true, address: true, label: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Profile"
        description="Your account details and the reference wallets you have on file."
        actions={
          <Avatar
            name={user.displayName ?? user.email}
            seed={user.id}
            size="lg"
          />
        }
      />

      <PageBody>
        <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Account</SectionTitle>
              <div className="flex gap-1.5">
                <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>
                {record?.isVerifiedMm ? <Badge tone="accent">Verified MM</Badge> : null}
              </div>
            </div>

            <dl className="divide-y divide-line text-body">
              <Row label="Display name" value={user.displayName ?? "not set"} mono />
              <Row label="Email" value={user.email} mono />
              <Row
                label="Email verified"
                value={record?.emailVerified ? "Yes" : "No"}
              />
              <Row
                label="Discord"
                value={record?.discordUsername ?? "not linked"}
                mono
              />
              <Row
                label="Terms accepted"
                value={
                  record?.termsAcceptedAt
                    ? record.termsAcceptedAt.toISOString().slice(0, 10)
                    : "not accepted"
                }
                mono
              />
              <Row
                label="Member since"
                value={record?.createdAt.toISOString().slice(0, 10) ?? "—"}
                mono
              />
            </dl>
          </Card>

          <Card className="space-y-3">
            <SectionTitle>Activity</SectionTitle>
            <dl className="divide-y divide-line text-body">
              <Row label="Active listings" value={String(listingCount)} mono />
              <Row label="Deals" value={String(dealCount)} mono />
              {record?.workingHoursUtc ? (
                <Row label="Working hours" value={record.workingHoursUtc} mono />
              ) : null}
              {record?.isVerifiedMm ? (
                <Row
                  label="Trades secured"
                  value={record.tradesSecured.toLocaleString("en-US")}
                  mono
                />
              ) : null}
            </dl>
            <Link
              href="/listings"
              className="inline-flex text-body font-medium text-accent-text underline underline-offset-2"
            >
              View the listings board
            </Link>
          </Card>

          <Card className="space-y-3 lg:col-span-2">
            <SectionTitle>Wallets</SectionTitle>
            <p className="text-meta text-ink-muted">
              Addresses are stored as plain reference text for humans to read.
              The platform never connects to a wallet and never holds keys.
            </p>
            {wallets.length === 0 ? (
              <EmptyState
                icon={Wallet}
                message="No wallet addresses on file. Add the addresses you trade from so a middleman can match a payment you send to your account. Use the form above."
              />
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {wallets.map((w) => (
                  <li
                    key={w.id}
                    className="flex h-row items-center justify-between px-4"
                  >
                    <span className="truncate font-mono text-body text-ink">
                      {w.address}
                    </span>
                    <span className="text-meta text-ink-faint">
                      {w.label ?? "unlabelled"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </PageBody>
    </AppShell>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`truncate font-medium text-ink ${mono ? "font-mono tnum" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
