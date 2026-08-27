/**
 * Middleman shift windows.
 *
 * `workingHoursUtc` is free text ("09:00-21:00 UTC", "flexible"), so this
 * parses what it can and returns null otherwise rather than guessing. Windows
 * are absolute UTC, so "on shift now" is the same answer for every viewer —
 * no client clock involved.
 */
export type ShiftWindow = { startHour: number; endHour: number };

export function parseShift(workingHoursUtc: string | null): ShiftWindow | null {
  if (!workingHoursUtc) return null;
  const m = workingHoursUtc.match(/^(\d{1,2}):00\s*[-–]\s*(\d{1,2}):00/);
  if (!m) return null;
  const startHour = Number(m[1]);
  const endHour = Number(m[2]);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;
  return { startHour, endHour };
}

export function isOnShift(workingHoursUtc: string | null, now = new Date()): boolean {
  const w = parseShift(workingHoursUtc);
  if (!w) return false;
  const hour = now.getUTCHours();
  // 24 is written as the end of the evening shift; treat it as midnight.
  const end = w.endHour === 0 ? 24 : w.endHour;
  return w.startHour <= end
    ? hour >= w.startHour && hour < end
    : hour >= w.startHour || hour < end; // wraps midnight
}

/** "on shift · 3h left" — enough to know whether to expect a fast reply. */
export function shiftStatus(
  workingHoursUtc: string | null,
  now = new Date(),
): { onShift: boolean; label: string } {
  const w = parseShift(workingHoursUtc);
  if (!w) {
    return {
      onShift: false,
      label: workingHoursUtc ? workingHoursUtc : 'hours not published',
    };
  }

  const hour = now.getUTCHours();
  const end = w.endHour === 0 ? 24 : w.endHour;

  if (isOnShift(workingHoursUtc, now)) {
    const hoursLeft = (end > hour ? end : end + 24) - hour;
    return { onShift: true, label: `on shift · ${hoursLeft}h left` };
  }

  const untilStart = (w.startHour > hour ? w.startHour : w.startHour + 24) - hour;
  return { onShift: false, label: `off shift · starts in ${untilStart}h` };
}
