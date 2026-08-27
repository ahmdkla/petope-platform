"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  body: string;
  kind: "USER" | "SYSTEM";
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
};

export type ChatRoom = {
  dealId: string;
  reference: string;
  projectName: string;
  status: string;
  unread: number;
  messages: ChatMessage[];
};

const SEEN_KEY = "exsaverse-chat-seen";

/** Per-room "last message id I have seen", so unread survives a reload. */
function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeSeen(next: Record<string, string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Private browsing: unread resets on reload, which is acceptable.
  }
}

/**
 * Polls the deal rooms this user belongs to.
 *
 * No realtime service is installed (CLAUDE.md lists Pusher/Ably as not chosen),
 * so this polls. Faster while the window is open and the tab is visible; slower
 * when collapsed, and paused entirely when the tab is hidden — a background tab
 * hammering the database for messages nobody is reading is waste.
 */
export function useChatRooms({ active }: { active: boolean }) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loaded, setLoaded] = useState(false);
  const seenRef = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/deal-messages", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { rooms: ChatRoom[] };

      const seen = seenRef.current;
      setRooms(
        data.rooms.map((r) => {
          const lastSeen = seen[r.dealId];
          if (!lastSeen) return { ...r, unread: 0 };
          const idx = r.messages.findIndex((m) => m.id === lastSeen);
          // Unread counts only what someone else wrote after your last look.
          const after = idx === -1 ? r.messages : r.messages.slice(idx + 1);
          return { ...r, unread: after.filter((m) => m.kind === "USER").length };
        }),
      );
      setLoaded(true);
    } catch {
      // Offline or a dropped request: keep the last known state and retry.
    }
  }, []);

  useEffect(() => {
    seenRef.current = readSeen();
  }, []);

  useEffect(() => {
    let cancelled = false;

    function schedule() {
      if (cancelled) return;
      const hidden = typeof document !== "undefined" && document.hidden;
      const delay = hidden ? 60_000 : active ? 8_000 : 25_000;
      timer.current = setTimeout(async () => {
        if (!document.hidden) await poll();
        schedule();
      }, delay);
    }

    void poll();
    schedule();

    // Catch up immediately when the tab comes back rather than waiting.
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, active]);

  /** Called when a room is on screen: everything in it counts as read. */
  const markRead = useCallback((dealId: string) => {
    setRooms((prev) => {
      const room = prev.find((r) => r.dealId === dealId);
      const last = room?.messages.at(-1);
      if (last) {
        seenRef.current = { ...seenRef.current, [dealId]: last.id };
        writeSeen(seenRef.current);
      }
      return prev.map((r) => (r.dealId === dealId ? { ...r, unread: 0 } : r));
    });
  }, []);

  const totalUnread = rooms.reduce((n, r) => n + r.unread, 0);

  return { rooms, loaded, totalUnread, markRead, refresh: poll };
}
