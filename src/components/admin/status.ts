import { BookingStatus } from '../../types';
import { STATUS_LABELS } from '../../lib/reports';

export const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  new: { label: STATUS_LABELS.new, cls: 'bg-primary-soft text-primary-dark' },
  confirmed: { label: STATUS_LABELS.confirmed, cls: 'bg-success/15 text-success' },
  done: { label: STATUS_LABELS.done, cls: 'bg-ink/10 text-ink' },
  cancelled: { label: STATUS_LABELS.cancelled, cls: 'bg-danger/15 text-danger' },
};

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const shiftIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
