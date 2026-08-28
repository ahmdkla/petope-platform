"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { setUserRole, blacklistUser, restoreUser } from "./actions";
import { Button, FormError, Hint, Label, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";

const ROLES: UserRole[] = ["USER", "MIDDLEMAN", "MAIN_MIDDLEMAN", "ADMIN"];

export function UserRow({
  userId,
  name,
  role,
  blacklisted,
  isSelf,
  actorRole,
}: {
  userId: string;
  name: string;
  role: UserRole;
  blacklisted: boolean;
  isSelf: boolean;
  actorRole: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function changeRole(next: UserRole) {
    setError(null);
    startTransition(async () => {
      const res = await setUserRole({ userId, role: next });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function doBlacklist() {
    setError(null);
    startTransition(async () => {
      const res = await blacklistUser({ userId, reason: reason.trim() });
      if (!res.ok) setError(res.error);
      else {
        setConfirming(false);
        setReason("");
        router.refresh();
      }
    });
  }

  function doRestore() {
    setError(null);
    startTransition(async () => {
      const res = await restoreUser(userId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor={`role-${userId}`} className="sr-only">
          Role for {name}
        </label>
        <Select
          id={`role-${userId}`}
          value={role}
          disabled={pending || isSelf}
          onChange={(e) => changeRole(e.target.value as UserRole)}
          className="h-9 w-44 text-meta"
        >
          {ROLES.map((r) => (
            <option
              key={r}
              value={r}
              // Only an admin may grant admin; a main middleman must not be
              // able to escalate beyond their own level.
              disabled={r === "ADMIN" && actorRole !== "ADMIN"}
            >
              {r.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </Select>

        {blacklisted ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={doRestore}>
            Restore
          </Button>
        ) : (
          <Button
            size="sm"
            variant="danger"
            disabled={pending || isSelf}
            onClick={() => setConfirming(true)}
          >
            Blacklist
          </Button>
        )}
      </div>

      {isSelf ? (
        <span className="text-meta text-ink-faint">your own account</span>
      ) : null}

      {error ? (
        <span role="alert" className="max-w-56 text-right text-meta text-danger">
          {error}
        </span>
      ) : null}

      {confirming ? (
        <Modal
          title={`Blacklist ${name}?`}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={pending} onClick={doBlacklist}>
                {pending ? "Blacklisting" : "Blacklist"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-left">
            <p className="text-body text-ink-muted">
              Their sessions are revoked immediately and they appear on the
              public blacklist page with the reason below.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor={`reason-${userId}`}>Reason</Label>
              <Textarea
                id={`reason-${userId}`}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                autoFocus
              />
              <Hint>Published. Write it for the person reading the blacklist.</Hint>
            </div>
            <FormError message={error} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
