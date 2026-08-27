"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Bot, MessagesSquare } from "lucide-react";
import { postMessage } from "./actions";
import { Avatar, Button, Card, FormError, SectionTitle, Textarea } from "@/components/ui";

type Message = {
  id: string;
  body: string;
  kind: "USER" | "SYSTEM";
  createdAt: Date;
  authorId: string | null;
  author: { id: string; displayName: string | null } | null;
};

/**
 * Deal-room conversation. Append-only: messages cannot be edited or deleted
 * because the transcript is a permanent record of what was agreed.
 */
export function DealChat({
  dealId,
  messages,
  currentUserId,
  readOnly,
}: {
  dealId: string;
  messages: Message[];
  currentUserId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
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
      const res = await postMessage(dealId, text);
      if (!res.ok) setError(res.error);
      else {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Conversation</SectionTitle>
        <span className="font-mono tnum text-meta text-ink-faint">
          {count} {count === 1 ? "message" : "messages"}
        </span>
      </div>

      <div
        className="max-h-[32rem] space-y-4 overflow-y-auto pr-1"
        aria-live="polite"
        aria-label="Deal room messages"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-raised px-6 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-lg border border-line bg-card text-ink-faint">
              <MessagesSquare aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-body text-ink-muted">
              No messages yet. Agree the terms here before anything is sent.
            </p>
          </div>
        ) : (
          messages.map((m) =>
            m.kind === "SYSTEM" ? (
              <SystemMessage key={m.id} message={m} />
            ) : (
              <UserMessage key={m.id} message={m} isSelf={m.authorId === currentUserId} />
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      {readOnly ? (
        <p className="rounded-md border border-line bg-raised px-3 py-2.5 text-meta text-ink-muted">
          This deal is closed. The transcript is kept as a permanent record.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3 border-t border-line pt-4">
          <label htmlFor="deal-message" className="sr-only">
            Message
          </label>
          <Textarea
            id="deal-message"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            placeholder="Write a message"
          />
          <p className="text-meta text-ink-faint">
            Never post a private key, seed phrase, or account password here.
            Those are exchanged off-platform.
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

function SystemMessage({ message }: { message: Message }) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-raised text-ink-faint"
      >
        <Bot className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 py-2.5">
        <p className="text-body text-ink-muted">{message.body}</p>
        <Stamp at={message.createdAt} />
      </div>
    </div>
  );
}

function UserMessage({ message, isSelf }: { message: Message; isSelf: boolean }) {
  const name = message.author?.displayName ?? "unknown";
  return (
    <div className="flex gap-3">
      <Avatar name={name} seed={message.author?.id ?? message.id} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-meta font-medium text-ink">{name}</span>
          {isSelf ? <span className="text-meta text-ink-faint">you</span> : null}
          <Stamp at={message.createdAt} inline />
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-body text-ink">
          {message.body}
        </p>
      </div>
    </div>
  );
}

function Stamp({ at, inline }: { at: Date; inline?: boolean }) {
  return (
    <time
      dateTime={at.toISOString()}
      className={`font-mono text-meta text-ink-faint ${inline ? "" : "mt-1 block"}`}
    >
      {at.toISOString().replace("T", " ").slice(0, 16)} UTC
    </time>
  );
}
