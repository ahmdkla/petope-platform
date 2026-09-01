import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Avatar, Badge, Card, Note, SectionTitle } from "@/components/ui";
import { isOnShift } from "@/lib/shifts";
import type { ActorRole } from "@/lib/deal-transitions";

type Party = {
  id: string;
  displayName: string | null;
  /** Middlemen only; buyers and sellers do not keep shifts. */
  workingHoursUtc?: string | null;
} | null;

export function Participants({
  deal,
  viewerRole,
}: {
  deal: { buyer: Party; seller: Party; middleman: Party };
  viewerRole: ActorRole;
}) {
  return (
    <Card className="space-y-4">
      <SectionTitle>Participants</SectionTitle>

      <ul className="space-y-3">
        <Party label="Buyer" party={deal.buyer} isYou={viewerRole === "BUYER"} />
        <Party label="Seller" party={deal.seller} isYou={viewerRole === "SELLER"} />
        <Party
          label="Middleman"
          party={deal.middleman}
          isYou={viewerRole === "MIDDLEMAN"}
          emptyText="Not yet claimed"
          showShift
        />
      </ul>

      <Note>
        Only these three people and the system bot can read this room. Admin
        audit access is permitted but always logged.
      </Note>

      {!deal.middleman ? (
        <p className="flex gap-2.5 rounded-md border border-warn/25 bg-warn-soft p-3 text-meta text-warn">
          <ShieldAlert aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          <span>
            No middleman has claimed this deal. Send nothing to anyone yet —
            middlemen never DM first.
          </span>
        </p>
      ) : null}
    </Card>
  );
}

function Party({
  label,
  party,
  isYou,
  emptyText,
  showShift,
}: {
  label: string;
  party: Party;
  isYou: boolean;
  emptyText?: string;
  showShift?: boolean;
}) {
  if (!party) {
    return (
      <li className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-dashed border-line text-ink-faint"
        >
          ?
        </span>
        <span>
          <span className="block text-meta text-ink-faint">{label}</span>
          <span className="block text-body text-ink-muted">
            {emptyText ?? "Unassigned"}
          </span>
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3">
      <Avatar
        name={party.displayName ?? "??"}
        seed={party.id}
        onShift={showShift ? isOnShift(party.workingHoursUtc ?? null) : undefined}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-meta text-ink-faint">{label}</span>
        <Link
          href={`/u/${party.id}`}
          className="block truncate font-mono text-body text-ink transition-opacity duration-200 hover:opacity-80"
        >
          {party.displayName ?? "unnamed"}
        </Link>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {isYou ? <Badge tone="neutral">You</Badge> : null}
      </span>
    </li>
  );
}
