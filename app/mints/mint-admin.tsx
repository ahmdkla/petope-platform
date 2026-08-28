"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CalendarClock } from "lucide-react";
import { createMintEvent, rescheduleMintEvent } from "./actions";
import { Button, FormError, Hint, Input, Label, Note, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { Combobox } from "@/components/combobox";

const CHAINS = ["Solana", "Base", "Ethereum", "Bitcoin", "Abstract", "Berachain", "Monad"];

/** Add a new entry. Middleman and admin only — the page gates on this. */
export function MintAdmin() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [chain, setChain] = useState("Solana");
  const [mintAt, setMintAt] = useState("");
  const [note, setNote] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mintAt) {
      setError("Set the mint date and time.");
      return;
    }
    startTransition(async () => {
      const res = await createMintEvent({
        projectName: projectName.trim(),
        chain: chain.trim(),
        mintAt: new Date(mintAt),
        note: note.trim() || null,
        projectLink: projectLink.trim() || null,
      });
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        setProjectName("");
        setMintAt("");
        setNote("");
        setProjectLink("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden className="size-[18px]" strokeWidth={2} />
        Add a mint
      </Button>

      {open ? (
        <Modal
          title="Add a mint"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button form="mint-form" type="submit" disabled={pending}>
                {pending ? "Adding" : "Add mint"}
              </Button>
            </>
          }
        >
          <form id="mint-form" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="projectName">Project</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mint-chain">Chain</Label>
              <Combobox
                id="mint-chain"
                value={chain}
                onChange={setChain}
                options={CHAINS}
                required
                maxLength={60}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mintAt">Mint date and time (UTC)</Label>
              <Input
                id="mintAt"
                type="datetime-local"
                value={mintAt}
                onChange={(e) => setMintAt(e.target.value)}
                required
              />
              <Hint>Release timers on linked deals run from this.</Hint>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="projectLink">Project link</Label>
              <Input
                id="projectLink"
                type="url"
                value={projectLink}
                onChange={(e) => setProjectLink(e.target.value)}
                placeholder="https://x.com/..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>

            <FormError message={error} />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/** Push a date back. Surfaces exactly which deals move and which do not. */
export function RescheduleButton({
  eventId,
  projectName,
  currentIso,
  linkedDeals,
}: {
  eventId: string;
  projectName: string;
  currentIso: string;
  linkedDeals: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mintAt, setMintAt] = useState(currentIso);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await rescheduleMintEvent(
        eventId,
        new Date(mintAt),
        note.trim() || null,
      );
      if (!res.ok) setError(res.error);
      else {
        setResult({ updated: res.updated, skipped: res.skipped });
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock aria-hidden className="size-4" strokeWidth={2} />
        Reschedule
      </Button>

      {open ? (
        <Modal
          title={`Reschedule ${projectName}`}
          onClose={() => {
            setOpen(false);
            setResult(null);
          }}
          footer={
            result ? (
              <Button
                onClick={() => {
                  setOpen(false);
                  setResult(null);
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button form={`resched-${eventId}`} type="submit" disabled={pending}>
                  {pending ? "Moving" : "Move the date"}
                </Button>
              </>
            )
          }
        >
          {result ? (
            <div className="space-y-3">
              <p className="text-body text-ink">
                <span className="font-mono tnum">{result.updated}</span>{" "}
                {result.updated === 1 ? "deal was" : "deals were"} updated.
              </p>
              {result.skipped > 0 ? (
                <Note>
                  <span className="font-mono tnum">{result.skipped}</span>{" "}
                  {result.skipped === 1 ? "deal was" : "deals were"} left alone
                  because their release timers have already started. Their
                  deadlines were fixed when the timer began and are never moved
                  afterwards. Each of those rooms has been told.
                </Note>
              ) : null}
            </div>
          ) : (
            <form id={`resched-${eventId}`} onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={`date-${eventId}`}>New mint date and time (UTC)</Label>
                <Input
                  id={`date-${eventId}`}
                  type="datetime-local"
                  value={mintAt}
                  onChange={(e) => setMintAt(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`note-${eventId}`}>Why (optional)</Label>
                <Textarea
                  id={`note-${eventId}`}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="The project announced a delay."
                />
                <Hint>Posted into every linked deal room.</Hint>
              </div>

              {linkedDeals > 0 ? (
                <Note>
                  {linkedDeals} {linkedDeals === 1 ? "deal is" : "deals are"} linked.
                  Any whose release timers have already started will keep their
                  existing deadlines — a running deadline is never moved
                  retroactively.
                </Note>
              ) : null}

              <FormError message={error} />
            </form>
          )}
        </Modal>
      ) : null}
    </>
  );
}
