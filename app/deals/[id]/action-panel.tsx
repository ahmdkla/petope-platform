"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { runTransition } from "./actions";
import type { ActorRole, TransitionId } from "@/lib/deal-transitions";
import { Button, Card, FormError, Note, SectionTitle } from "@/components/ui";
import { Modal } from "@/components/modal";

/**
 * Plain data only. The transition rules carry `guard` and `systemMessage`
 * functions, which cannot cross the server/client boundary — the server
 * component flattens them before they get here.
 */
export type SerializedTransition = {
  id: TransitionId;
  label: string;
  description: string;
  destructive: boolean;
  blockedReason: string | null;
};

/**
 * Every action available to this actor in this state, driven entirely by the
 * transition config. Blocked actions render disabled WITH their reason rather
 * than disappearing — a hidden control looks identical to a broken one.
 */
export function ActionPanel({
  dealId,
  items,
  role,
}: {
  dealId: string;
  items: SerializedTransition[];
  role: ActorRole;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<SerializedTransition | null>(null);

  function run(id: TransitionId) {
    setError(null);
    startTransition(async () => {
      const res = await runTransition(dealId, id);
      if (!res.ok) setError(res.error);
      else {
        setConfirming(null);
        router.refresh();
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card className="space-y-3">
        <SectionTitle>Actions</SectionTitle>
        <Note>
          {role === "BUYER" || role === "SELLER"
            ? "Nothing for you to do right now. The middleman moves this deal forward."
            : "No actions are available in this state."}
        </Note>
      </Card>
    );
  }

  // Only one primary action per screen; the rest are subordinate.
  const primary = items.find((i) => !i.destructive && !i.blockedReason);

  return (
    <Card className="space-y-4">
      <SectionTitle>Actions</SectionTitle>

      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t.id} className="space-y-1.5">
            <Button
              variant={
                t.destructive ? "danger" : t.id === primary?.id ? "primary" : "secondary"
              }
              pending={pending} disabled={Boolean(t.blockedReason)}
              onClick={() => setConfirming(t)}
              className="w-full"
            >
              {t.label}
            </Button>
            {t.blockedReason ? (
              <p className="flex gap-1.5 text-meta text-warn">
                <AlertCircle aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
                {t.blockedReason}
              </p>
            ) : (
              <p className="text-meta text-ink-faint">{t.description}</p>
            )}
          </li>
        ))}
      </ul>

      <FormError message={error} />

      {confirming ? (
        <Modal
          title={confirming.label}
          onClose={() => setConfirming(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                variant={confirming.destructive ? "danger" : "primary"}
                pending={pending}
                onClick={() => run(confirming.id)}
              >
                {pending ? "Working…" : confirming.label}
              </Button>
            </>
          }
        >
          <p className="text-body text-ink-muted">{confirming.description}</p>
          {confirming.destructive ? (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-meta text-danger">
              This cannot be undone.
            </p>
          ) : null}
        </Modal>
      ) : null}
    </Card>
  );
}
