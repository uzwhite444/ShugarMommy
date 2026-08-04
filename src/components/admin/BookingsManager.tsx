import { useMemo, useState } from 'react';
import { Check, Search, Trash2 } from 'lucide-react';
import { Booking, BookingStatus } from '../../types';
import { formatPrice } from '../../utils';
import { STATUS_META, shiftIso, todayIso } from './status';

interface BookingsManagerProps {
  bookings: Booking[];
  onStatus: (id: string, status: BookingStatus) => void;
  onDelete: (id: string) => void;
}

type DateFilter = 'all' | 'today' | 'tomorrow' | 'week';
type SortMode = 'created' | 'visit';

const DATE_FILTERS: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: 'Все даты' },
  { value: 'today', label: 'Сегодня' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'week', label: '7 дней' },
];

const STATUS_FILTERS: Array<{ value: BookingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'confirmed', label: 'Подтверждённые' },
  { value: 'done', label: 'Выполненные' },
  { value: 'cancelled', label: 'Отменённые' },
];

export default function BookingsManager({ bookings, onStatus, onDelete }: BookingsManagerProps) {
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sort, setSort] = useState<SortMode>('created');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const today = todayIso();
    let list = bookings;
    if (status !== 'all') list = list.filter((b) => b.status === status);
    if (dateFilter === 'today') list = list.filter((b) => b.visit_date === today);
    else if (dateFilter === 'tomorrow') list = list.filter((b) => b.visit_date === shiftIso(1));
    else if (dateFilter === 'week') list = list.filter((b) => b.visit_date >= today && b.visit_date <= shiftIso(7));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.phone.toLowerCase().includes(q) ||
          b.services.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) =>
      sort === 'created'
        ? b.created_at.localeCompare(a.created_at)
        : (a.visit_date + a.visit_time).localeCompare(b.visit_date + b.visit_time),
    );
  }, [bookings, status, dateFilter, sort, query]);

  const chip = (active: boolean) =>
    `btn-press rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active ? 'bg-ink text-canvas' : 'border border-hairline text-muted hover:text-ink'
    }`;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setStatus(f.value)} className={chip(status === f.value)}>
            {f.label}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
        {DATE_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setDateFilter(f.value)} className={chip(dateFilter === f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, телефон или зона…"
            className="w-full rounded-lg border border-hairline bg-canvas py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-primary"
          aria-label="Сортировка"
        >
          <option value="created">Сначала свежие заявки</option>
          <option value="visit">По дате визита</option>
        </select>
        <span className="ml-auto text-sm text-muted">
          {visible.length} из {bookings.length}
        </span>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="py-16 text-center text-muted">Ничего не найдено.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((b) => (
            <li key={b.id} className="rounded-xl bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {b.customer_name}
                    <a
                      href={`tel:${b.phone.replace(/[^+\d]/g, '')}`}
                      className="ml-3 font-semibold text-primary-dark hover:underline"
                    >
                      {b.phone}
                    </a>
                  </p>
                  <p className="mt-1 text-sm text-muted">{b.services}</p>
                  <p className="mt-1.5 text-sm text-body">
                    {new Date(b.visit_date + 'T00:00:00').toLocaleDateString('ru-RU', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                    })}
                    {' · '}
                    {b.visit_time}
                    {b.master && <> · {b.master}</>}
                    {b.total_price > 0 && (
                      <>
                        {' · '}
                        <span className="font-semibold text-ink">{formatPrice(b.total_price)}</span>
                      </>
                    )}
                  </p>
                  {b.comment && <p className="mt-1.5 text-sm italic text-muted">«{b.comment}»</p>}
                  {b.source && (
                    <p className="mt-1.5 inline-block rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">
                      Источник: {b.source}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_META[b.status].cls}`}>
                    {STATUS_META[b.status].label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {b.status === 'new' && (
                      <button
                        onClick={() => onStatus(b.id, 'confirmed')}
                        className="btn-press flex items-center gap-1 rounded-lg bg-success/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-success"
                      >
                        <Check size={13} /> Подтвердить
                      </button>
                    )}
                    <select
                      value={b.status}
                      onChange={(e) => onStatus(b.id, e.target.value as BookingStatus)}
                      className="rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                      aria-label="Изменить статус"
                    >
                      {(Object.keys(STATUS_META) as BookingStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => onDelete(b.id)}
                      aria-label="Удалить заявку"
                      title="Удалить заявку"
                      className="btn-press rounded-lg border border-hairline p-1.5 text-muted hover:border-danger hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-faint">Создана: {new Date(b.created_at).toLocaleString('ru-RU')}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
