import { useMemo } from 'react';
import { CalendarDays, CalendarClock, Phone, Wallet, Receipt } from 'lucide-react';
import { Booking } from '../../types';
import { formatPrice } from '../../utils';
import { STATUS_META, shiftIso, toIsoDay, todayIso } from './status';

interface OverviewProps {
  bookings: Booking[];
}

/** Bookings-per-day bar chart for the last 14 days — plain SVG, no deps. */
function ActivityChart({ bookings }: { bookings: Booking[] }) {
  const days = useMemo(() => {
    const out: Array<{ iso: string; label: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const iso = shiftIso(-i);
      out.push({
        iso,
        label: new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }),
        count: 0,
      });
    }
    const index = new Map(out.map((d, i) => [d.iso, i]));
    for (const b of bookings) {
      // created_at is a UTC timestamp — bucket it by the local day.
      const iso = toIsoDay(new Date(b.created_at));
      const i = index.get(iso);
      if (i !== undefined) out[i].count += 1;
    }
    return out;
  }, [bookings]);

  const max = Math.max(1, ...days.map((d) => d.count));
  const W = 560;
  const H = 120;
  const bw = W / days.length;

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Заявки по дням">
      {days.map((d, i) => {
        const h = Math.max(2, (d.count / max) * H);
        return (
          <g key={d.iso}>
            <rect
              x={i * bw + 5}
              y={H - h}
              width={bw - 10}
              height={h}
              rx={4}
              fill={d.count > 0 ? '#C17456' : '#E4DBCC'}
            />
            {d.count > 0 && (
              <text x={i * bw + bw / 2} y={H - h - 5} textAnchor="middle" fontSize="11" fill="#6F6558">
                {d.count}
              </text>
            )}
            {i % 2 === 1 && (
              <text x={i * bw + bw / 2} y={H + 13} textAnchor="middle" fontSize="9" fill="#978C7E">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function Overview({ bookings }: OverviewProps) {
  const today = todayIso();
  const tomorrow = shiftIso(1);
  const monthAgo = shiftIso(-30);

  const stats = useMemo(() => {
    const active = (b: Booking) => b.status !== 'cancelled';
    const done30 = bookings.filter((b) => b.status === 'done' && b.visit_date >= monthAgo);
    const revenue30 = done30.reduce((s, b) => s + (b.total_price || 0), 0);
    return {
      today: bookings.filter((b) => b.visit_date === today && active(b)).length,
      tomorrow: bookings.filter((b) => b.visit_date === tomorrow && active(b)).length,
      fresh: bookings.filter((b) => b.status === 'new').length,
      revenue30,
      avgCheck: done30.length > 0 ? Math.round(revenue30 / done30.length) : 0,
    };
  }, [bookings, today, tomorrow, monthAgo]);

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== 'cancelled' && (b.visit_date === today || b.visit_date === tomorrow))
        .sort((a, b) => (a.visit_date + a.visit_time).localeCompare(b.visit_date + b.visit_time))
        .slice(0, 8),
    [bookings, today, tomorrow],
  );

  const cards = [
    { icon: CalendarDays, label: 'Визитов сегодня', value: String(stats.today) },
    { icon: CalendarClock, label: 'Визитов завтра', value: String(stats.tomorrow) },
    { icon: Phone, label: 'Новых заявок', value: String(stats.fresh), accent: true },
    { icon: Wallet, label: 'Выручка · 30 дней', value: formatPrice(stats.revenue30) },
    { icon: Receipt, label: 'Средний чек · 30 дней', value: formatPrice(stats.avgCheck) },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-surface p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              <card.icon size={12} /> {card.label}
            </p>
            <p className={`display mt-1.5 text-2xl lg:text-3xl ${card.accent ? 'text-primary-dark' : 'text-ink'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Заявки за 14 дней</p>
          <div className="mt-4">
            <ActivityChart bookings={bookings} />
          </div>
        </div>

        <div className="rounded-xl bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ближайшие визиты</p>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-muted">На сегодня и завтра записей нет.</p>
          ) : (
            <ul className="mt-3 divide-y divide-hairline">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {b.visit_date === today ? 'Сегодня' : 'Завтра'} {b.visit_time} · {b.customer_name}
                    </p>
                    <p className="truncate text-xs text-muted">{b.services}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_META[b.status].cls}`}>
                    {STATUS_META[b.status].label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
