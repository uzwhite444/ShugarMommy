import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, LogOut, Phone, RefreshCw, Search, Wallet } from 'lucide-react';
import { Booking, BookingStatus } from '../types';
import { fetchBookings, updateBookingStatus } from '../lib/bookings';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils';

const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  new: { label: 'Новая', cls: 'bg-primary-soft text-primary-dark' },
  confirmed: { label: 'Подтверждена', cls: 'bg-success/15 text-success' },
  done: { label: 'Выполнена', cls: 'bg-ink/10 text-ink' },
  cancelled: { label: 'Отменена', cls: 'bg-danger/15 text-danger' },
};

const FILTERS: Array<{ value: BookingStatus | 'all' | 'today'; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'today', label: 'На сегодня' },
  { value: 'new', label: 'Новые' },
  { value: 'confirmed', label: 'Подтверждённые' },
  { value: 'done', label: 'Выполненные' },
  { value: 'cancelled', label: 'Отменённые' },
];

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | 'all' | 'today'>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setBookings(await fetchBookings());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (id: string, status: BookingStatus) => {
    // Optimistic update; reload on failure to stay truthful.
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    const ok = await updateBookingStatus(id, status);
    if (!ok) load();
  };

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const todayCount = bookings.filter((b) => b.visit_date === today && b.status !== 'cancelled').length;
    const newCount = bookings.filter((b) => b.status === 'new').length;
    const doneRevenue = bookings
      .filter((b) => b.status === 'done')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);
    return { todayCount, newCount, doneRevenue };
  }, [bookings, today]);

  const visible = useMemo(() => {
    let list = bookings;
    if (filter === 'today') list = list.filter((b) => b.visit_date === today && b.status !== 'cancelled');
    else if (filter !== 'all') list = list.filter((b) => b.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.phone.toLowerCase().includes(q) ||
          b.services.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bookings, filter, query, today]);

  const statCards = [
    { icon: CalendarDays, label: 'Визитов сегодня', value: String(stats.todayCount), accent: false },
    { icon: Phone, label: 'Новых заявок', value: String(stats.newCount), accent: true },
    { icon: Wallet, label: 'Выручка (выполненные)', value: formatPrice(stats.doneRevenue), accent: false },
  ];

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <p className="font-serif text-xl font-semibold">
            Shugar Mommy<span className="text-primary">.</span>{' '}
            <span className="text-sm font-sans font-medium text-muted">· админ</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="btn-press flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink hover:border-muted"
            >
              <RefreshCw size={14} /> Обновить
            </button>
            <button
              onClick={() => supabase?.auth.signOut()}
              className="btn-press flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-muted hover:border-danger hover:text-danger"
            >
              <LogOut size={14} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-xl bg-surface p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                <card.icon size={13} /> {card.label}
              </p>
              <p className={`display mt-2 text-4xl ${card.accent ? 'text-primary-dark' : 'text-ink'}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`btn-press rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                filter === f.value ? 'bg-ink text-canvas' : 'border border-hairline text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Имя, телефон или зона…"
              className="w-full rounded-lg border border-hairline bg-canvas py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
        </div>

        {/* Bookings */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={30} className="animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-20 text-center text-muted">Заявок нет.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {visible.map((b) => (
              <li key={b.id} className="rounded-xl bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {b.customer_name}
                      <a href={`tel:${b.phone.replace(/[^+\d]/g, '')}`} className="ml-3 font-semibold text-primary-dark hover:underline">
                        {b.phone}
                      </a>
                    </p>
                    <p className="mt-1 text-sm text-muted">{b.services}</p>
                    <p className="mt-1.5 text-sm text-body">
                      {new Date(b.visit_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                      {' · '}{b.visit_time}
                      {b.master && <> · {b.master}</>}
                      {b.total_price > 0 && <> · <span className="font-semibold text-ink">{formatPrice(b.total_price)}</span></>}
                    </p>
                    {b.comment && <p className="mt-1.5 text-sm italic text-muted">«{b.comment}»</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_META[b.status].cls}`}>
                      {STATUS_META[b.status].label}
                    </span>
                    <select
                      value={b.status}
                      onChange={(e) => handleStatus(b.id, e.target.value as BookingStatus)}
                      className="rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-sm outline-none focus:border-primary"
                      aria-label="Изменить статус"
                    >
                      {(Object.keys(STATUS_META) as BookingStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-faint">
                  Создана: {new Date(b.created_at).toLocaleString('ru-RU')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
