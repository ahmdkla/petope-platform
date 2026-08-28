"use client";

import { useState, useTransition, useRef, useEffect, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Bot,
  MessagesSquare,
  ShieldCheck,
  Receipt,
  Check,
  Clock3,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { postMessage } from "./actions";
import { Avatar, Button, Card, FormError, SectionTitle, Textarea } from "@/components/ui";
import { classifySystemMessage, type SystemEvent } from "@/lib/deal-events";

type Message = {
  id: string;
  body: string;
  kind: "USER" | "SYSTEM";
  createdAt: Date;
  authorId: string | null;
  author: { id: string; displayName: string | null } | null;
  /** Shown locally, not yet acknowledged by the server. */
  optimistic?: boolean;
};

/**
 * The deal room's activity feed: what people said and what the deal did, in one
 * chronological stream.
 *
 * System events — claims, terms locks, proof submissions, middleman
 * verifications, timers, rulings — are written as `SYSTEM` messages by the
 * engine at the moment they happen, so ordering is a plain `createdAt` sort
 * rather than a merge of two sources that could disagree. Keeping them beside
 * the conversation is the point: "the middleman confirmed the payment" belongs
 * next to the sentence where the buyer said they had sent it.
 *
 * Append-only: nothing here can be edited or deleted, because the transcript is
 * a permanent record of what was agreed.
 */
export function DealChat({
  dealId,
  messages,
  currentUserId,
  currentUserName,
  readOnly,
}: {
  dealId: string;
  messages: Message[];
  currentUserId: string;
  currentUserName: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  /**
   * Optimistic send. The message appears the instant it is submitted and is
   * replaced by the server's copy when the refresh lands.
   *
   * This is safe to be optimistic about because posting a message is the one
   * action here that cannot change deal state, move money, or be rejected on
   * business grounds — only the transport can fail, and that path restores the
   * draft rather than pretending it went. Nothing on the escrow path is
   * optimistic: a proof, a confirmation or a release shows a real pending state
   * and waits for the server, because guessing at those would be showing the
   * user money that has not moved.
   */
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (current: Message[], text: string): Message[] => [
      ...current,
      {
        id: `optimistic-${current.length}`,
        body: text,
        kind: "USER",
        createdAt: new Date(),
        authorId: currentUserId,
        author: { id: currentUserId, displayName: currentUserName },
        optimistic: true,
      },
    ],
  );

  const count = optimistic.length;

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
    setBody("");
    startTransition(async () => {
      addOptimistic(text);
      const res = await postMessage(dealId, text);
      if (!res.ok) {
        setError(res.error);
        // Give the text back rather than losing what they wrote; the optimistic
        // row disappears with the transition.
        setBody(text);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Activity</SectionTitle>
        <span className="font-mono tnum text-meta text-ink-faint">
          {count} {count === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div
        className="max-h-[32rem] space-y-4 overflow-y-auto pr-1"
        aria-live="polite"
        aria-label="Deal room messages"
      >
        {optimistic.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-raised px-6 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-lg border border-line bg-card text-ink-faint">
              <MessagesSquare aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <p className="max-w-sm text-body text-ink-muted">
              Nothing has happened yet. Messages between the three of you, and
              every step the deal takes, appear here in order. Agree the terms
              before anything is sent.
            </p>
          </div>
        ) : (
          optimistic.map((m) =>
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
            <Button type="submit" pending={pending}>
              <Send aria-hidden className="size-4" strokeWidth={2} />
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

const EVENT_ICON = {
  bot: Bot,
  shield: ShieldCheck,
  receipt: Receipt,
  check: Check,
  clock: Clock3,
  alert: TriangleAlert,
  undo: Undo2,
} as const;

/** Tint per event class, so the feed is scannable without reading every line. */
const EVENT_TONE: Record<SystemEvent["tone"], { mark: string; panel: string }> = {
  neutral: {
    mark: "border-line bg-raised text-ink-faint",
    panel: "border-line bg-raised",
  },
  money: {
    mark: "border-accent-line bg-accent-soft text-accent-text",
    panel: "border-accent-line bg-accent-soft",
  },
  ok: {
    mark: "border-ok/40 bg-ok-soft text-ok",
    panel: "border-ok/30 bg-ok-soft",
  },
  warn: {
    mark: "border-warn/40 bg-warn-soft text-warn",
    panel: "border-warn/30 bg-warn-soft",
  },
  danger: {
    mark: "border-danger/40 bg-danger-soft text-danger",
    panel: "border-danger/30 bg-danger-soft",
  },
};

function SystemMessage({ message }: { message: Message }) {
  const event = classifySystemMessage(message.body);
  const Icon = EVENT_ICON[event.icon];
  const tone = EVENT_TONE[event.tone];

  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className={`grid size-8 shrink-0 place-items-center rounded-lg border ${tone.mark}`}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 ${tone.panel}`}>
        <p className="text-meta font-medium uppercase tracking-wide text-ink-faint">
          {event.label}
        </p>
        <p className="mt-1 text-body text-ink-muted">{message.body}</p>
        <Stamp at={message.createdAt} />
      </div>
    </div>
  );
}

function UserMessage({ message, isSelf }: { message: Message; isSelf: boolean }) {
  const name = message.author?.displayName ?? "unknown";
  return (
    // Slightly dimmed until the server has it: shown immediately, but not
    // claimed as saved.
    <div className={`flex gap-3 ${message.optimistic ? "opacity-60" : ""}`}>
      <Avatar name={name} seed={message.author?.id ?? message.id} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-meta font-medium text-ink">{name}</span>
          {isSelf ? <span className="text-meta text-ink-faint">you</span> : null}
          {message.optimistic ? (
            <span className="text-meta text-ink-faint">sending…</span>
          ) : (
            <Stamp at={message.createdAt} inline />
          )}
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
