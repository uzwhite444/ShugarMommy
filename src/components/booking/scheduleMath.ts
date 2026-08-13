/**
 * Pure schedule maths shared by the booking modal's slot-fetching hook and its
 * date-strip UI: no state, no side effects, just WorkWindow arithmetic.
 */
import { Master, WorkWindow } from '../../types';
import { masterHoursOn, masterKey, STUDIO_HOURS } from '../../data';
import { timeToMinutes } from '../../lib/availability';

/** Shortest bookable visit — one grid cell, even with no zones picked. */
export const MIN_DURATION_MIN = 30;

/**
 * 30-minute slots from opening until 30 minutes before closing. The window is
 * now per-master and per-date, so this can no longer be computed once: Ангелина
 * opens at 09:00 while Муслима is already there from 08:00.
 */
export function buildTimeSlots(hours: WorkWindow | null): string[] {
  if (!hours) return [];
  const open = timeToMinutes(hours.open);
  const close = timeToMinutes(hours.close);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return [];
  const slots: string[] = [];
  for (let t = Math.ceil(open / 30) * 30; t <= close - 30; t += 30) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

function widen(current: WorkWindow | null, next: WorkWindow): WorkWindow {
  if (!current) return next;
  return {
    open: next.open < current.open ? next.open : current.open,
    close: next.close > current.close ? next.close : current.close,
  };
}

/**
 * Widest window these masters ever work — the preview shown before a date is
 * picked, when no single day's rule applies yet.
 *
 * Takes a list rather than one master because "любой мастер" is now scoped to
 * the masters who can actually do the selected zones: STUDIO_HOURS would
 * promise Муслима's 08:00 for a face zone only Рената performs from 11:00.
 */
export function widestHours(masters: readonly Master[]): WorkWindow {
  // Not named `window`: shadowing the DOM global here confuses narrowing.
  let widest: WorkWindow | null = null;
  for (const master of masters) {
    for (const rule of master.schedule) {
      widest = widen(widest, { open: rule.open, close: rule.close });
    }
  }
  // Every master has at least one rule; the fallback keeps the type honest.
  return widest ?? STUDIO_HOURS;
}

/** Combined window of these masters on one date, or null when none of them works. */
export function unionHoursOn(masters: readonly Master[], date: string): WorkWindow | null {
  let combined: WorkWindow | null = null;
  for (const master of masters) {
    const hours = masterHoursOn(master, date);
    if (hours) combined = widen(combined, hours);
  }
  return combined;
}

/**
 * Canonical names of the masters who could actually take a visit STARTING at
 * `slot` and running `durationMin` — on shift that date AND with the whole
 * visit inside their own window.
 *
 * Per-SLOT, not per-day, and that is the entire point. "Любой мастер" is only
 * blocked when every master in the roster is busy, so a day-level roster counts
 * a master whose shift starts at 11:00 as "free" at 08:00. One booking with
 * Муслима then left 08:00 clickable, because Рената and Ангелина — who are not
 * in the building — looked idle. The grid runs on the union window (08:00–20:00),
 * so those edge hours exist every working day.
 */
export function mastersCovering(
  masters: readonly Master[],
  date: string,
  slot: string,
  durationMin: number,
): string[] {
  const start = timeToMinutes(slot);
  const end = start + durationMin;
  const covering: string[] = [];
  for (const master of masters) {
    const hours = masterHoursOn(master, date);
    if (!hours) continue;
    if (timeToMinutes(hours.open) <= start && end <= timeToMinutes(hours.close)) {
      covering.push(masterKey(master));
    }
  }
  return covering;
}
