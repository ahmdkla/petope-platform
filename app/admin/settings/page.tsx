import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  getMmFeeConfig,
  getCollateralMinimum,
  getMaxConcurrentDeals,
} from "@/lib/admin-settings";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Card, Note, SectionTitle } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [fee, collateral, maxDeals, rows] = await Promise.all([
    getMmFeeConfig(),
    getCollateralMinimum(),
    getMaxConcurrentDeals(),
    db.adminSetting.findMany({
      include: { updatedBy: { select: { displayName: true } } },
      orderBy: { key: "asc" },
    }),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Values the escrow engine reads at runtime. None of these is hardcoded in the code."
      />

      <PageBody>
        <div className="max-w-3xl space-y-6">
          <Note>
            Changes take effect immediately for new work. Deals already running
            keep the figures they were created with — a fee is frozen when terms
            lock, and a release deadline is fixed when its timer starts.
          </Note>

          <SettingsForm
            initial={{
              feePercent: fee.percentBasisPoints / 100,
              feeFloorStable: Number(fee.floor.STABLE) / 1_000_000,
              feeFloorSol: Number(fee.floor.SOL) / 1_000_000_000,
              refundWindowHours: fee.refundWindowHours,
              collateralMinimum: Number(collateral?.amount ?? 5_000_000n) / 1_000_000,
              maxConcurrentDeals: maxDeals,
            }}
          />

          <Card className="space-y-3">
            <SectionTitle>Stored rows</SectionTitle>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.key} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-mono text-meta text-ink">{r.key}</p>
                  <pre className="mt-1 overflow-x-auto rounded-md border border-line bg-raised p-2.5 font-mono text-meta text-ink-muted">
                    {JSON.stringify(r.value, null, 2)}
                  </pre>
                  <p className="mt-1 text-meta text-ink-faint">
                    {r.updatedBy?.displayName ? `by ${r.updatedBy.displayName} · ` : ""}
                    {r.updatedAt.toISOString().slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </PageBody>
    </AppShell>
  );
}
