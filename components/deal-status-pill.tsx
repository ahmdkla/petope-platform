import type { DealStatus } from "@prisma/client";
import {
  CircleDot, UserCheck, Lock, Clock, Wallet, Truck, Hourglass,
  CircleCheckBig, CheckCircle2, TriangleAlert, Undo2, CircleSlash,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui";
import { DEAL_STATUS_LABEL } from "@/lib/deal-meta";

/** Each lifecycle state gets its own colour, used everywhere the state appears. */
const STATE: Record<DealStatus, { tone: BadgeTone; icon: LucideIcon }> = {
  OPEN: { tone: "neutral", icon: CircleDot },
  CLAIMED: { tone: "info", icon: UserCheck },
  TERMS_LOCKED: { tone: "info", icon: Lock },
  AWAITING_PAYMENT: { tone: "warn", icon: Clock },
  FUNDED: { tone: "accent", icon: Wallet },
  DELIVERING: { tone: "accent", icon: Truck },
  AWAITING_MINT: { tone: "warn", icon: Hourglass },
  AWAITING_CONFIRMATION: { tone: "warn", icon: CircleCheckBig },
  COMPLETED: { tone: "ok", icon: CheckCircle2 },
  DISPUTED: { tone: "danger", icon: TriangleAlert },
  REFUNDED: { tone: "danger", icon: Undo2 },
  CANCELLED: { tone: "neutral", icon: CircleSlash },
};

export function DealStatusPill({ status }: { status: DealStatus }) {
  const { tone, icon: Icon } = STATE[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2} />
      {DEAL_STATUS_LABEL[status]}
    </Badge>
  );
}
