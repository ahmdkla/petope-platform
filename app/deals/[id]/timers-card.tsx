"use client";

import { useEffect, useState } from "react";
import { Timer, TriangleAlert } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui";

export type TimerView = {
  key: string;
  label: string;
  deadlineIso: string;
  /** What happens when it elapses. Stated plainly, never implied. */
  consequence: string;
};

/**
 * Countdowns to the stored absolute deadlines.
 *
 * The deadline is computed server-side and never recalculated here — this only
 * renders the remaining time. An elapsed timer changes what the middleman is
 * allowed to do; it never moves money by itself.
 */
export function TimersCard({
  timers,
  paused,
}: {
  timers: TimerView[];
  paused: boolean;
}) {
  if (timers.length === 0) return null;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Timer aria-hidden className="size-[18px] text-ink-faint" strokeWidth={1.75} />
        <SectionTitle>Release timers</SectionTitle>
      </div>

      {paused ? (
        <p className="flex gap-2.5 rounded-md border border-warn/25 bg-warn-soft p-3 text-meta text-warn">
          <TriangleAlert aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          Timers are paused while this deal is under review.
        </p>
      ) : null}

      <ul className="space-y-3">
        {timers.map((t) => (
          <Countdown key={t.key} timer={t} paused={paused} />
        ))}
      </ul>

      <p className="border-t border-line pt-3 text-meta text-ink-faint">
        Deadlines were fixed when the timer started. Retuning a method later does
        not move a running deadline.
      </p>
    </Card>
  );
}

function Countdown({ timer, paused }: { timer: TimerView; paused: boolean }) {
  const target = new Date(timer.deadlineIso).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target, paused]);

  const elapsed = remaining <= 0;
  // Under an hour is the point where a human should act now.
  const urgent = !elapsed && remaining < 3_600_000;

  return (
    <li className="rounded-lg border border-line bg-raised p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-medium text-ink">{timer.label}</span>
        <span
          className={`font-mono tnum text-body font-semibold ${
            elapsed ? "text-danger" : urgent ? "text-warn" : "text-ink"
          }`}
          // Announce only when it matters, not every tick.
          aria-live={urgent || elapsed ? "polite" : "off"}
        >
          {elapsed ? "Elapsed" : format(remaining)}
        </span>
      </div>
      <p className="mt-1 text-meta text-ink-muted">{timer.consequence}</p>
      <p className="mt-1 font-mono text-meta text-ink-faint">
        {timer.deadlineIso.replace("T", " ").slice(0, 16)} UTC
      </p>
    </li>
  );
}

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
