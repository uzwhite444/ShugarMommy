import { BookingStatus } from '../../types';
import { STATUS_LABELS } from '../../lib/reports';

export const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  new: { label: STATUS_LABELS.new, cls: 'bg-primary-soft text-primary-dark' },
  confirmed: { label: STATUS_LABELS.confirmed, cls: 'bg-success/15 text-success' },
  done: { label: STATUS_LABELS.done, cls: 'bg-ink/10 text-ink' },
  cancelled: { label: STATUS_LABELS.cancelled, cls: 'bg-danger/15 text-danger' },
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
