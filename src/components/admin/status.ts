import { BookingStatus } from '../../types';
import { STATUS_LABELS } from '../../lib/reports';

/**
 * Outlined, not tinted, for the two coloured statuses. A 15% self-tint under
 * its own colour lifts the background toward the text and cost «Подтверждена»
 * 2.78:1 and «Отменена» 3.12:1 — the owner reads these badges to tell a live
 * booking from a cancelled one. On the card's own surface the same tokens are
 * 5.1:1 and 5.5:1. `new` and `done` keep their fills: their pairs already pass.
 */
export const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  new: { label: STATUS_LABELS.new, cls: 'bg-primary-soft text-primary-dark' },
  confirmed: { label: STATUS_LABELS.confirmed, cls: 'border border-success/40 text-success' },
  done: { label: STATUS_LABELS.done, cls: 'bg-ink/10 text-ink' },
  cancelled: { label: STATUS_LABELS.cancelled, cls: 'border border-danger/40 text-danger' },
};

/**
 * Local YYYY-MM-DD (no UTC shift) — bookings.visit_date is written as a local
 * date in the studio timezone, so comparing against a UTC date would be off by
 * one every night between 00:00 and 05:00 local time.
 */
export const toIsoDay = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const todayIso = (): string => toIsoDay(new Date());

export const shiftIso = (days: number): string => {
  const now = new Date();
  return toIsoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
};
