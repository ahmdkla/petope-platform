"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, Send, Bot, ExternalLink, Minus, X } from "lucide-react";
import { useChatRooms, type ChatMessage } from "./use-chat-rooms";
import { postMessage } from "@/app/deals/[id]/actions";
import { Avatar } from "@/components/ui";
import { shortReference } from "@/lib/reference";

/**
 * Floating deal-room chat, bottom-right.
 *
 * Every deal room the user belongs to is reachable from one window, so they can
 * browse listings while a middleman is mid-conversation. The inline view on the
 * deal room page stays — this is in addition to it, not a replacement.
 */
export function FloatingChat({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { rooms, loaded, totalUnread, markRead, refresh } = useChatRooms({ active: open });

  const active = rooms.find((r) => r.dealId === activeId) ?? rooms[0] ?? null;
  const activeDealId = active?.dealId;
  // Re-runs when a new message arrives in the room already on screen.
  const activeLastMessageId = active?.messages.at(-1)?.id;

  // A room that is on screen has been read.
  useEffect(() => {
    if (open && activeDealId) markRead(activeDealId);
  }, [open, activeDealId, activeLastMessageId, markRead]);

  if (!loaded && rooms.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          totalUnread > 0
            ? `Open deal chat, ${totalUnread} unread`
            : "Open deal chat"
        }
        className="fixed bottom-5 right-5 z-50 flex h-14 items-center gap-2.5 rounded-xl border border-line bg-card px-4 shadow-overlay transition-colors duration-200 hover:border-line-strong sm:bottom-6 sm:right-6"
      >
        <MessageSquare aria-hidden className="size-5 text-ink-muted" strokeWidth={1.75} />
        <span className="hidden text-body font-medium text-ink sm:inline">Deal chat</span>
        {totalUnread > 0 ? (
          <span
            className="grid min-w-6 place-items-center rounded-md bg-accent px-1.5 py-0.5 font-mono tnum text-meta font-bold text-accent-ink"
            aria-live="polite"
          >
            {totalUnread}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <section
      aria-label="Deal chat"
      className="fixed inset-0 z-50 flex flex-col border-line bg-card shadow-overlay sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(34rem,calc(100dvh-6rem))] sm:w-[min(26rem,calc(100vw-3rem))] sm:rounded-xl sm:border"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2">
          <MessageSquare aria-hidden className="size-4 text-ink-muted" strokeWidth={1.75} />
          <span className="text-body font-semibold text-ink">Deal chat</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close deal chat"
          className="grid size-11 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors duration-200 hover:bg-raised hover:text-ink sm:size-8"
        >
          <X aria-hidden className="size-5 sm:hidden" strokeWidth={2} />
          <Minus aria-hidden className="hidden size-4 sm:block" strokeWidth={2} />
        </button>
      </header>

      {rooms.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-6 text-center text-body text-ink-muted">
          No open deal rooms. Opening a deal from a listing starts one, with a
          middleman, the other party, and this conversation.
        </p>
      ) : (
        <>
          {/* A switcher rather than tabs: a middleman can hold seven rooms and
              tabs would shrink past legibility. */}
          {rooms.length > 1 ? (
            <div className="shrink-0 border-b border-line px-3 py-2">
              <label htmlFor="chat-room" className="sr-only">
                Deal room
              </label>
              <select
                id="chat-room"
                value={active?.dealId ?? ""}
                onChange={(e) => setActiveId(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-md border border-line bg-raised px-2 text-meta text-ink focus:border-accent-line focus:outline-none"
              >
                {rooms.map((r) => (
                  <option key={r.dealId} value={r.dealId}>
                    {r.projectName} — {shortReference(r.reference)}
                    {r.unread > 0 ? `  (${r.unread})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {active ? (
            <RoomView
              key={active.dealId}
              room={active}
              currentUserId={currentUserId}
              onSent={refresh}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function RoomView({
  room,
  currentUserId,
  onSent,
}: {
  room: { dealId: string; reference: string; projectName: string; messages: ChatMessage[] };
  currentUserId: string;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const lastId = room.messages.at(-1)?.id;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [lastId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await postMessage(room.dealId, text);
      if (!res.ok) setError(res.error);
      else {
        setBody("");
        onSent();
      }
    });
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="min-w-0">
          <span className="block truncate text-meta font-medium text-ink">
            {room.projectName}
          </span>
          <span
            title={room.reference}
            className="block truncate font-mono text-meta text-ink-faint"
          >
            {shortReference(room.reference)}
          </span>
        </span>
        <Link
          href={`/deals/${room.dealId}`}
          className="flex shrink-0 items-center gap-1.5 text-meta text-accent-text underline underline-offset-2"
        >
          Open room
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={2} />
        </Link>
      </div>

      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-label={`Messages in ${room.projectName}`}
      >
        {room.messages.length === 0 ? (
          <p className="py-6 text-center text-meta text-ink-muted">
            No messages yet. Anything said here, and every step the deal takes,
            appears in order.
          </p>
        ) : (
          room.messages.map((m) =>
            m.kind === "SYSTEM" ? (
              <div key={m.id} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-raised text-ink-faint"
                >
                  <Bot className="size-3.5" strokeWidth={1.75} />
                </span>
                <p className="min-w-0 flex-1 rounded-md border border-line bg-raised px-2.5 py-2 text-meta text-ink-muted">
                  {m.body}
                </p>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5">
                <Avatar
                  name={m.authorName ?? "??"}
                  seed={m.authorId ?? m.id}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-meta font-medium text-ink">
                      {m.authorName ?? "unknown"}
                    </span>
                    {m.authorId === currentUserId ? (
                      <span className="text-meta text-ink-faint">you</span>
                    ) : null}
                    <time
                      dateTime={m.createdAt}
                      className="font-mono text-meta text-ink-faint"
                    >
                      {m.createdAt.slice(11, 16)}
                    </time>
                  </span>
                  <span className="mt-0.5 block whitespace-pre-wrap break-words text-meta text-ink">
                    {m.body}
                  </span>
                </span>
              </div>
            ),
          )
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={submit}
        className="shrink-0 space-y-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3"
      >
        {error ? (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <label htmlFor={`chat-${room.dealId}`} className="sr-only">
            Message
          </label>
          <input
            id={`chat-${room.dealId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            placeholder="Write a message"
            className="h-11 min-w-0 flex-1 rounded-md border border-line bg-raised px-3 text-meta text-ink placeholder:text-ink-faint focus:border-accent-line focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !body.trim()}
            aria-label="Send message"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md bg-accent text-accent-ink transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send aria-hidden className="size-4" strokeWidth={2} />
          </button>
        </div>
        <p className="text-meta text-ink-faint">
          Never send a private key or password here.
        </p>
      </form>
    </>
  );
}
