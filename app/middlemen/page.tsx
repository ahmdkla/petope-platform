import type { Metadata } from "next";
import { db } from "@/lib/db";
import { DemoBanner } from "@/components/demo-banner";

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

  return (
    <div className="flex min-h-full flex-col">
      <DemoBanner />

      <main className="w-full px-6 py-8">
        <h1 className="text-xl font-semibold text-ink">Middleman roster</h1>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          This page is the only authoritative list of EXSAVERSE middlemen.
        </p>

        <div className="mt-4 max-w-2xl rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          Middlemen never DM you first. If someone contacts you claiming to be
          staff, they are an impersonator. Verify the exact handle here before
          sending funds, credentials, or a wallet.
        </div>

        {middlemen.length === 0 ? (
          <p className="mt-8 text-xs text-ink-muted">
            No middlemen are listed yet.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left">
                  <Th>Handle</Th>
                  <Th>Role</Th>
                  <Th>Working hours</Th>
                  <Th align="right">Trades secured</Th>
                  <Th align="right">Vouches</Th>
                </tr>
              </thead>
              <tbody>
                {middlemen.map((m) => (
                  <tr
                    key={m.id}
                    className="h-row border-b border-line last:border-0 hover:bg-panel"
                  >
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-ink">
                          {m.displayName ?? "unnamed"}
                        </span>
                        {m.isVerifiedMm ? (
                          <span className="rounded-md border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-2xs font-medium text-accent">
                            Verified
                          </span>
                        ) : (
                          <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 text-2xs text-ink-faint">
                            Unverified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 text-xs text-ink-muted">
                      {m.role === "MAIN_MIDDLEMAN" ? "Main middleman" : "Middleman"}
                    </td>
                    <td className="px-3 font-mono text-xs text-ink-muted">
                      {m.workingHoursUtc ?? "not published"}
                    </td>
                    <td className="px-3 text-right font-mono tnum text-ink">
                      {m.tradesSecured.toLocaleString("en-US")}
                    </td>
                    <td className="px-3 text-right font-mono tnum text-ink-muted">
                      {m._count.vouchesReceived.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 max-w-2xl text-2xs text-ink-faint">
          Vouch counts are the number of published testimonials tied to a
          completed deal. No aggregate rating is shown.
        </p>
      </main>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`h-8 px-3 text-2xs font-medium uppercase tracking-wide text-ink-faint ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
