import { useMemo, useState } from 'react';
import { Braces, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Booking } from '../../types';
import { formatPrice } from '../../utils';
import {
  computeMetrics,
  exportCSV,
  exportExcel,
  exportJSON,
  exportPDF,
  filterByPeriod,
} from '../../lib/reports';
import { shiftIso, todayIso } from './status';

interface ReportsProps {
  bookings: Booking[];
}

type Preset = 'today' | 'week' | 'month' | 'all' | 'custom';

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: '7 дней' },
  { value: 'month', label: '30 дней' },
  { value: 'all', label: 'Всё время' },
  { value: 'custom', label: 'Свой период' },
];

export default function Reports({ bookings }: ReportsProps) {
  const [preset, setPreset] = useState<Preset>('month');
  const [customFrom, setCustomFrom] = useState(shiftIso(-30));
  const [customTo, setCustomTo] = useState(todayIso());
  const [pdfBlocked, setPdfBlocked] = useState(false);

  const { from, to, label } = useMemo(() => {
    const today = todayIso();
    switch (preset) {
      case 'today':
        return { from: today, to: today, label: `сегодня (${today})` };
      case 'week':
        return { from: shiftIso(-6), to: today, label: `${shiftIso(-6)} — ${today}` };
      case 'month':
        return { from: shiftIso(-29), to: today, label: `${shiftIso(-29)} — ${today}` };
      case 'custom':
        return { from: customFrom, to: customTo, label: `${customFrom} — ${customTo}` };
      default:
        return { from: null, to: null, label: 'всё время' };
    }
  }, [preset, customFrom, customTo]);

  const filtered = useMemo(() => filterByPeriod(bookings, from, to), [bookings, from, to]);
  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);
  const filename = `shugarmommy-report-${from ?? 'start'}-${to ?? todayIso()}`;

  const summary = [
    { label: 'Всего заявок', value: String(metrics.total) },
    { label: 'Выполнено', value: String(metrics.byStatus.done) },
    { label: 'Отменено', value: String(metrics.byStatus.cancelled) },
    { label: 'Выручка', value: formatPrice(metrics.revenueDone) },
    { label: 'Средний чек', value: formatPrice(metrics.avgCheck) },
    { label: 'Конверсия в визит', value: `${metrics.conversion}%` },
  ];

  const exportBtn =
    'btn-press flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-ink hover:border-muted';

  return (
    <div>
      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`btn-press rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              preset === p.value ? 'bg-ink text-canvas' : 'border border-hairline text-muted hover:text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-sm outline-none focus:border-primary"
              aria-label="С даты"
            />
            —
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-sm outline-none focus:border-primary"
              aria-label="По дату"
            />
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{s.label}</p>
            <p className="display mt-1.5 text-2xl text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Breakdown tables */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">По мастерам</p>
          {metrics.byMaster.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Нет данных за период.</p>
          ) : (
            <div className="-mx-1 mt-3 overflow-x-auto px-1">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint">
                  <th className="pb-2 font-semibold">Мастер</th>
                  <th className="pb-2 font-semibold">Заявок</th>
                  <th className="pb-2 text-right font-semibold">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {metrics.byMaster.map((m) => (
                  <tr key={m.master}>
                    <td className="py-2 font-medium text-ink">{m.master}</td>
                    <td className="py-2 text-body">{m.count}</td>
                    <td className="py-2 text-right font-semibold text-ink">{formatPrice(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Популярные зоны</p>
          {metrics.topServices.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Нет данных за период.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {metrics.topServices.map((s) => {
                const max = metrics.topServices[0].count;
                return (
                  <li key={s.service} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate font-medium text-ink sm:w-40">{s.service}</span>
                    <span className="h-2 rounded-full bg-primary/70" style={{ width: `${(s.count / max) * 100}%`, minWidth: 8 }} />
                    <span className="text-muted">{s.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Traffic sources */}
      <div className="mt-4 rounded-xl bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Откуда пришли клиентки</p>
        {metrics.bySource.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Нет данных за период.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {metrics.bySource.map((s) => (
              <li key={s.source} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3.5 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{s.source}</span>
                <span className="shrink-0 text-muted">
                  {s.count} · <span className="font-semibold text-ink">{formatPrice(s.revenue)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Export */}
      <div className="mt-6 rounded-xl bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Скачать отчёт · {filtered.length} заявок за период
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => exportCSV(filtered, filename)} className={exportBtn}>
            <FileSpreadsheet size={16} className="text-success" /> CSV
          </button>
          <button onClick={() => exportExcel(filtered, metrics, label, filename)} className={exportBtn}>
            <FileDown size={16} className="text-success" /> Excel
          </button>
          <button
            onClick={() => setPdfBlocked(!exportPDF(filtered, metrics, label))}
            className={exportBtn}
          >
            <FileText size={16} className="text-danger" /> PDF
          </button>
          <button onClick={() => exportJSON(filtered, metrics, filename)} className={exportBtn}>
            <Braces size={16} className="text-muted" /> JSON
          </button>
        </div>
        <p className="mt-3 text-xs text-faint">
          CSV и Excel открываются в Excel/Google Таблицах (кириллица настроена). PDF — через окно печати:
          выберите «Сохранить как PDF».
          {pdfBlocked && (
            <span className="ml-1 font-semibold text-danger">
              Браузер заблокировал окно — разрешите всплывающие окна для этого сайта.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
