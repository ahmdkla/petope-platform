"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Bot, CheckCircle2, Archive, RotateCcw } from "lucide-react";
import type { SupportStatus } from "@prisma/client";
import { postSupportMessage, setTicketStatus } from "../actions";
import {
  Avatar,
  Button,
  Card,
  FormError,
  SectionTitle,
  Textarea,
} from "@/components/ui";

type Message = {
  id: string;
  body: string;
  kind: "USER" | "SYSTEM";
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
};

/**
 * Same shape as the deal-room conversation, deliberately: same append-only
 * transcript, same system-bot messages, no escrow attached.
 */
export function SupportThread({
  ticketId,
  messages,
  currentUserId,
  readOnly,
  isStaff,
  status,
}: {
  ticketId: string;
  messages: Message[];
  currentUserId: string;
  readOnly: boolean;
  isStaff: boolean;
  status: SupportStatus;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const count = messages.length;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [count]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setError("Write a message first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await postSupportMessage(ticketId, text);
      if (!res.ok) setError(res.error);
      else {
        setBody("");
        router.refresh();
      }
    });
  }

  function changeStatus(next: "RESOLVED" | "CLOSED" | "OPEN") {
    setError(null);
    startTransition(async () => {
      const res = await setTicketStatus(ticketId, next);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Conversation</SectionTitle>
        <div className="flex items-center gap-2">
          {isStaff && status !== "RESOLVED" && status !== "CLOSED" ? (
            <Button size="sm" variant="secondary" onClick={() => changeStatus("RESOLVED")}>
              <CheckCircle2 aria-hidden className="size-4" strokeWidth={2} />
              Mark resolved
            </Button>
          ) : null}
          {status === "CLOSED" ? (
            isStaff ? (
              <Button size="sm" variant="secondary" onClick={() => changeStatus("OPEN")}>
                <RotateCcw aria-hidden className="size-4" strokeWidth={2} />
                Reopen
              </Button>
            ) : null
          ) : (
            <Button size="sm" variant="secondary" onClick={() => changeStatus("CLOSED")}>
              <Archive aria-hidden className="size-4" strokeWidth={2} />
              Close
            </Button>
          )}
        </div>
      </div>

      <div
        className="max-h-[34rem] space-y-4 overflow-y-auto pr-1"
        aria-live="polite"
        aria-label="Support messages"
      >
        {messages.map((m) =>
          m.kind === "SYSTEM" ? (
            <div key={m.id} className="flex gap-3">
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-raised text-ink-faint"
              >
                <Bot className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 py-2.5">
                <p className="text-body text-ink-muted">{m.body}</p>
                <Stamp at={m.createdAt} />
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <Avatar
                name={m.authorName ?? "??"}
                seed={m.authorId ?? m.id}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-mono text-meta font-medium text-ink">
                    {m.authorName ?? "unknown"}
                  </span>
                  {m.authorId === currentUserId ? (
                    <span className="text-meta text-ink-faint">you</span>
                  ) : null}
                  <Stamp at={m.createdAt} inline />
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-body text-ink">
                  {m.body}
                </p>
              </div>
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      {readOnly ? (
        <p className="rounded-md border border-line bg-raised px-3 py-2.5 text-meta text-ink-muted">
          This room is closed. The transcript is kept as a permanent record.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3 border-t border-line pt-4">
          <label htmlFor="support-message" className="sr-only">
            Message
          </label>
          <Textarea
            id="support-message"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            placeholder="Write a message"
          />
          <p className="text-meta text-ink-faint">
            Never post a private key, seed phrase, or password. Support will
            never ask for one.
          </p>
          <FormError message={error} />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              <Send aria-hidden className="size-4" strokeWidth={2} />
              {pending ? "Sending" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function Stamp({ at, inline }: { at: string; inline?: boolean }) {
  return (
    <time
      dateTime={at}
      className={`font-mono text-meta text-ink-faint ${inline ? "" : "mt-1 block"}`}
    >
      {at.replace("T", " ").slice(0, 16)} UTC
    </time>
  );
}
