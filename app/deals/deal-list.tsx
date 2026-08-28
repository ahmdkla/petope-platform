import Link from "next/link";
import { DealStatusPill } from "@/components/deal-status-pill";
import { DealReference } from "@/components/deal-reference";
import { formatMoney, type SettlementAsset } from "@/lib/money";
import type { DealStatus } from "@prisma/client";

export type DealRow = {
  id: string;
  reference: string;
  projectName: string;
  status: DealStatus;
  role: "Buyer" | "Seller" | "Middleman";
  middlemanName: string;
  amount: bigint;
  asset: SettlementAsset;
};

/**
 * The deal list in two shapes off one row set.
 *
 * Six columns need about 1100px to lay out without the amount — the column
 * people are actually looking for — sliding out of view. The sidebar takes 240
 * of those, so the table only earns its place from `xl` up; below that each
 * deal is a card. The rows are mapped once so the two renderings cannot drift
 * apart.
 */
export function DealList({ rows }: { rows: DealRow[] }) {
  return (
    <>
      <ul className="space-y-3 xl:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-line bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/deals/${r.id}`}
                className="min-w-0 flex-1 text-body font-semibold text-ink"
              >
                {r.projectName}
              </Link>
              <DealStatusPill status={r.status} />
            </div>

            <p className="mt-2">
              <DealReference reference={r.reference} href={`/deals/${r.id}`} />
            </p>

            <dl className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-meta">
              <span className="flex items-baseline gap-1.5">
                <dt className="text-ink-faint">Role</dt>
                <dd className="text-ink-muted">{r.role}</dd>
              </span>
              <span className="flex min-w-0 items-baseline gap-1.5">
                <dt className="text-ink-faint">MM</dt>
                <dd className="truncate font-mono text-ink-muted">
                  {r.middlemanName}
                </dd>
              </span>
              <span className="ml-auto flex items-baseline gap-1.5">
                <dt className="sr-only">Amount</dt>
                <dd className="font-mono tnum text-lead font-medium text-ink">
                  {formatMoney(r.amount, r.asset)}
                </dd>
              </span>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-line bg-card shadow-card xl:block">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-line bg-raised">
              <Th>Reference</Th>
              <Th>Project</Th>
              <Th>Status</Th>
              <Th>Your role</Th>
              <Th>Middleman</Th>
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="h-row border-b border-line transition-colors duration-200 last:border-0 hover:bg-raised"
              >
                <td className="px-4">
                  <DealReference reference={r.reference} href={`/deals/${r.id}`} />
                </td>
                <td className="max-w-[16rem] truncate px-4 text-body text-ink">
                  {r.projectName}
                </td>
                <td className="px-4">
                  <DealStatusPill status={r.status} />
                </td>
                <td className="px-4 text-body text-ink-muted">{r.role}</td>
                <td className="px-4 font-mono text-body text-ink-muted">
                  {r.middlemanName}
                </td>
                <td className="px-4 text-right font-mono tnum text-lead text-ink">
                  {formatMoney(r.amount, r.asset)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
      className={`h-12 px-4 text-meta font-semibold uppercase tracking-wide text-ink-faint ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
