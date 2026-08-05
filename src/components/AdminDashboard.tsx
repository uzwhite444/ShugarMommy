import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, CalendarOff, FileBarChart, Home, LayoutDashboard, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { Booking, BookingStatus } from '../types';
import { deleteBooking, fetchBookings, updateBookingStatus } from '../lib/bookings';
import { supabase } from '../lib/supabase';
import Overview from './admin/Overview';
import BookingsManager from './admin/BookingsManager';
import Schedule from './admin/Schedule';
import Reports from './admin/Reports';

type Section = 'overview' | 'bookings' | 'schedule' | 'reports';

const NAV: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'bookings', label: 'Заявки', icon: CalendarClock },
  { id: 'schedule', label: 'Расписание', icon: CalendarOff },
  { id: 'reports', label: 'Отчёты', icon: FileBarChart },
];

const REFRESH_MS = 60_000;

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('overview');

  // Порядковый номер загрузки: применяется только ответ самого свежего запроса.
  const loadSeq = useRef(0);
  // Статусы, изменённые админом; держим их, пока сервер не подтвердит значение,
  // чтобы уже летящее автообновление не откатило свежее действие.
  const pendingStatus = useRef(new Map<string, BookingStatus>());

  const load = useCallback(async (silent = false) => {
    const seq = ++loadSeq.current;
    if (!silent) setLoading(true);
    const data = await fetchBookings();
    if (seq !== loadSeq.current) return; // устаревший ответ — состоянием владеет более новый запрос
    setBookings(
      data.map((b) => {
        const pending = pendingStatus.current.get(b.id);
        if (!pending) return b;
        if (pending === b.status) {
          pendingStatus.current.delete(b.id);
          return b;
        }
        return { ...b, status: pending };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Тихое автообновление, чтобы новые заявки появлялись без действий админа.
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleStatus = async (id: string, status: BookingStatus) => {
    // Optimistic update; reload on failure to stay truthful.
    pendingStatus.current.set(id, status);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    const ok = await updateBookingStatus(id, status);
    if (!ok) {
      pendingStatus.current.delete(id);
      load();
    }
  };

  const handleDelete = async (id: string) => {
    const b = bookings.find((x) => x.id === id);
    if (!window.confirm(`Удалить заявку «${b?.customer_name ?? ''}» безвозвратно?`)) return;
    const ok = await deleteBooking(id);
    if (ok) {
      pendingStatus.current.delete(id);
      setBookings((prev) => prev.filter((x) => x.id !== id));
    } else {
      window.alert(
        'Не удалось удалить. Если удаление ещё не включено — выполните supabase/03_admin_delete.sql в Supabase SQL Editor.',
      );
    }
  };

  const fresh = bookings.filter((b) => b.status === 'new').length;

  const navBtn = (active: boolean) =>
    `btn-press ink-rule rule-row rule-on-dark flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold ${
      active ? 'bg-ondark/10 text-ondark' : 'text-ondark-soft hover:text-ondark'
    }`;

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink lg:grid lg:grid-cols-[230px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden bg-dark lg:flex lg:flex-col">
        <div className="border-b border-ondark/10 px-5 py-5">
          <p className="font-serif text-lg font-semibold text-ondark">
            Shugar Mommy<span className="text-primary">.</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ondark-soft">
            панель управления
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? 'page' : undefined}
              className={navBtn(section === item.id)}
            >
              <item.icon size={16} />
              {item.label}
              {item.id === 'bookings' && fresh > 0 && (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                  {fresh}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-ondark/10 px-3 py-4">
          <button onClick={() => load()} className={navBtn(false)}>
            <RefreshCw size={15} /> Обновить
          </button>
          <a href="/" className={navBtn(false)}>
            <Home size={15} /> На сайт
          </a>
          <button onClick={() => supabase?.auth.signOut()} className={`${navBtn(false)} hover:!text-danger`}>
            <LogOut size={15} /> Выйти
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur-sm lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <p className="font-serif text-lg font-semibold">
            Shugar Mommy<span className="text-primary">.</span>{' '}
            <span className="font-sans text-xs font-medium text-muted">· админ</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => load()} aria-label="Обновить" className="press-inner rounded-lg p-2 text-muted transition-colors hover:text-ink">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => supabase?.auth.signOut()}
              aria-label="Выйти"
              className="press-inner rounded-lg p-2 text-muted transition-colors hover:text-danger"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 px-3 pb-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? 'page' : undefined}
              className={`btn-press ink-rule rule-chip rule-short flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                section === item.id ? 'bg-ink text-canvas' : 'text-muted'
              }`}
            >
              <item.icon size={14} />
              {item.label}
              {item.id === 'bookings' && fresh > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{fresh}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">
        <h1 className="display mb-6 hidden text-3xl text-ink lg:block">
          {NAV.find((n) => n.id === section)?.label}
        </h1>
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 size={30} className="animate-spin text-primary" />
          </div>
        ) : section === 'overview' ? (
          <Overview bookings={bookings} />
        ) : section === 'bookings' ? (
          <BookingsManager bookings={bookings} onStatus={handleStatus} onDelete={handleDelete} />
        ) : section === 'schedule' ? (
          <Schedule bookings={bookings} />
        ) : (
          <Reports bookings={bookings} />
        )}
      </main>
    </div>
  );
}
