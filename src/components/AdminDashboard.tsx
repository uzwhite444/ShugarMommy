import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, LogOut, Phone, RefreshCw, Wallet } from 'lucide-react';
import { Booking, BookingStatus } from '../types';
import { fetchBookings, updateBookingStatus } from '../lib/bookings';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils';

const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  new: { label: 'Новая', cls: 'bg-honey text-caramel-dark' },
  confirmed: { label: 'Подтверждена', cls: 'bg-success/15 text-success' },
  done: { label: 'Выполнена', cls: 'bg-cocoa/10 text-cocoa' },
  cancelled: { label: 'Отменена', cls: 'bg-danger/15 text-danger' },
};

const FILTERS: Array<{ value: BookingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'confirmed', label: 'Подтверждённые' },
  { value: 'done', label: 'Выполненные' },
  { value: 'cancelled', label: 'Отменённые' },
];

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | 'all'>('all');

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

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = bookings.filter((b) => b.visit_date === today && b.status !== 'cancelled').length;
    const newCount = bookings.filter((b) => b.status === 'new').length;
    const doneRevenue = bookings
      .filter((b) => b.status === 'done')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);
    return { todayCount, newCount, doneRevenue };
  }, [bookings]);

  const visible = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div className="min-h-screen bg-cream font-sans text-cocoa">
      <header className="sticky top-0 z-10 border-b border-cocoa/10 bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <p className="font-serif text-xl font-semibold">
            Shugar<span className="text-caramel">Mommy</span> · Админ
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-full border border-cocoa/15 px-4 py-2 text-sm font-semibold hover:border-caramel hover:text-caramel"
            >
              <RefreshCw size={15} /> Обновить
            </button>
            <button
              onClick={() => supabase?.auth.signOut()}
              className="flex items-center gap-1.5 rounded-full border border-cocoa/15 px-4 py-2 text-sm font-semibold hover:border-danger hover:text-danger"
            >
              <LogOut size={15} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-card p-5 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-taupe">
              <CalendarDays size={14} /> Визитов сегодня
            </p>
            <p className="mt-1 font-serif text-4xl font-semibold">{stats.todayCount}</p>
          </div>
          <div className="rounded-3xl bg-card p-5 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-taupe">
              <Phone size={14} /> Новых заявок
            </p>
            <p className="mt-1 font-serif text-4xl font-semibold text-caramel-dark">{stats.newCount}</p>
          </div>
          <div className="rounded-3xl bg-card p-5 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-taupe">
              <Wallet size={14} /> Выручка (выполненные)
            </p>
            <p className="mt-1 font-serif text-4xl font-semibold">{formatPrice(stats.doneRevenue)}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filter === f.value ? 'bg-caramel text-cream' : 'bg-card text-taupe hover:text-cocoa'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bookings */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-caramel" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-20 text-center text-taupe">Заявок нет.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visible.map((b) => (
              <li key={b.id} className="rounded-3xl bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {b.customer_name}
                      <a href={`tel:${b.phone.replace(/[^+\d]/g, '')}`} className="ml-3 font-semibold text-caramel">
                        {b.phone}
                      </a>
                    </p>
                    <p className="mt-1 text-sm text-taupe">{b.services}</p>
                    <p className="mt-1 text-sm">
                      📅 {b.visit_date} · 🕐 {b.visit_time}
                      {b.master && <> · 👩‍🔬 {b.master}</>}
                      {b.total_price > 0 && <> · 💰 {formatPrice(b.total_price)}</>}
                    </p>
                    {b.comment && <p className="mt-1 text-sm italic text-taupe">«{b.comment}»</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_META[b.status].cls}`}>
                      {STATUS_META[b.status].label}
                    </span>
                    <select
                      value={b.status}
                      onChange={(e) => handleStatus(b.id, e.target.value as BookingStatus)}
                      className="rounded-xl border border-cocoa/15 bg-cream px-3 py-1.5 text-sm outline-none focus:border-caramel"
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
                <p className="mt-2 text-xs text-taupe/70">
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
