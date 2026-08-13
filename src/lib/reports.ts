import { Booking, BookingStatus } from '../types';
import { STUDIO_NAME } from '../utils';

/**
 * Report aggregation + client-side export builders (CSV / Excel / PDF / JSON).
 * Everything runs in the browser — no extra dependencies.
 */

export const STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  done: 'Выполнена',
  cancelled: 'Отменена',
};

export interface ReportMetrics {
  total: number;
  byStatus: Record<BookingStatus, number>;
  revenueDone: number;
  avgCheck: number;
  /** done / (total - cancelled), % */
  conversion: number;
  byMaster: Array<{ master: string; count: number; revenue: number }>;
  topServices: Array<{ service: string; count: number }>;
  bySource: Array<{ source: string; count: number; revenue: number }>;
}

export function filterByPeriod(bookings: Booking[], from: string | null, to: string | null): Booking[] {
  return bookings.filter((b) => {
    if (from && b.visit_date < from) return false;
    if (to && b.visit_date > to) return false;
    return true;
  });
}

export function computeMetrics(bookings: Booking[]): ReportMetrics {
  const byStatus: Record<BookingStatus, number> = { new: 0, confirmed: 0, done: 0, cancelled: 0 };
  const masters = new Map<string, { count: number; revenue: number }>();
  const services = new Map<string, number>();
  const sources = new Map<string, { count: number; revenue: number }>();
  let revenueDone = 0;

  for (const b of bookings) {
    byStatus[b.status] += 1;
    if (b.status === 'done') revenueDone += b.total_price || 0;

    const masterName = b.master || 'Любой мастер';
    const m = masters.get(masterName) ?? { count: 0, revenue: 0 };
    m.count += 1;
    if (b.status === 'done') m.revenue += b.total_price || 0;
    masters.set(masterName, m);

    const sourceName = b.source || 'Не определён';
    const s = sources.get(sourceName) ?? { count: 0, revenue: 0 };
    s.count += 1;
    if (b.status === 'done') s.revenue += b.total_price || 0;
    sources.set(sourceName, s);

    for (const raw of b.services.split(',')) {
      const s = raw.trim();
      if (s) services.set(s, (services.get(s) ?? 0) + 1);
    }
  }

  const active = bookings.length - byStatus.cancelled;
  return {
    total: bookings.length,
    byStatus,
    revenueDone,
    avgCheck: byStatus.done > 0 ? Math.round(revenueDone / byStatus.done) : 0,
    conversion: active > 0 ? Math.round((byStatus.done / active) * 100) : 0,
    byMaster: [...masters.entries()]
      .map(([master, v]) => ({ master, ...v }))
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count),
    topServices: [...services.entries()]
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    bySource: [...sources.entries()]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const DETAIL_HEADERS = [
  'Дата визита',
  'Время',
  'Имя',
  'Телефон',
  'Зоны',
  'Мастер',
  'Сумма (сум)',
  'Статус',
  'Источник',
  'Комментарий',
  'Заявка создана',
];

function bookingRow(b: Booking): string[] {
  return [
    b.visit_date,
    b.visit_time,
    b.customer_name,
    b.phone,
    b.services,
    b.master || 'Любой мастер',
    String(b.total_price || 0),
    STATUS_LABELS[b.status],
    b.source || '',
    b.comment || '',
    new Date(b.created_at).toLocaleString('ru-RU'),
  ];
}

/**
 * Excel/LibreOffice выполняют содержимое ячейки, начинающееся с = + - @, таба
 * или перевода строки. Все поля заявки приходят от посетителя, поэтому такой
 * текст обезвреживается ведущим апострофом (CSV formula injection).
 */
function neutralizeFormula(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** CSV с BOM и разделителем «;» — открывается в русском Excel без настройки. */
export function exportCSV(bookings: Booking[], filename: string): void {
  const esc = (v: string) => `"${neutralizeFormula(v).replace(/"/g, '""')}"`;
  const lines = [DETAIL_HEADERS, ...bookings.map(bookingRow)].map((row) => row.map(esc).join(';'));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  download(blob, `${filename}.csv`);
}

export function exportJSON(bookings: Booking[], metrics: ReportMetrics, filename: string): void {
  const blob = new Blob([JSON.stringify({ metrics, bookings }, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  download(blob, `${filename}.json`);
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Полный HTML отчёта — используется и для Excel (.xls), и для PDF (печать). */
function reportHtml(bookings: Booking[], metrics: ReportMetrics, periodLabel: string): string {
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n);
  const th = (t: string) => `<th style="background:#EFE8DB;border:1px solid #d9cfbc;padding:6px 10px;text-align:left;font-size:12px">${t}</th>`;
  // Excel открывает этот HTML как таблицу, поэтому ячейки обезвреживаются так же, как в CSV.
  const td = (t: string) => `<td style="border:1px solid #e4dbcc;padding:5px 10px;font-size:12px">${escapeHtml(neutralizeFormula(t))}</td>`;

  const summaryRows = [
    ['Всего заявок', String(metrics.total)],
    ['Выполнено', String(metrics.byStatus.done)],
    ['Подтверждено', String(metrics.byStatus.confirmed)],
    ['Новые', String(metrics.byStatus.new)],
    ['Отменено', String(metrics.byStatus.cancelled)],
    ['Выручка (выполненные)', `${fmt(metrics.revenueDone)} сум`],
    ['Средний чек', `${fmt(metrics.avgCheck)} сум`],
    ['Конверсия в визит', `${metrics.conversion}%`],
  ];

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>${STUDIO_NAME} — отчёт</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#1D1712;background:#fff;margin:32px}
  h1{font-size:24px;margin:0 0 4px}
  h2{font-size:15px;margin:26px 0 8px}
  .muted{color:#6F6558;font-size:12px;font-family:Arial,sans-serif}
  table{border-collapse:collapse;width:100%;font-family:Arial,sans-serif;margin-top:6px}
  @media print { body{margin:12mm} }
</style></head><body>
<h1>${STUDIO_NAME}<span style="color:#C17456">.</span> — отчёт</h1>
<p class="muted">Период: ${escapeHtml(periodLabel)} · Сформирован: ${new Date().toLocaleString('ru-RU')}</p>

<h2>Сводка</h2>
<table>${summaryRows.map(([k, v]) => `<tr>${td(k)}${td(v)}</tr>`).join('')}</table>

<h2>По мастерам</h2>
<table><tr>${th('Мастер')}${th('Заявок')}${th('Выручка (выполненные)')}</tr>
${metrics.byMaster.map((m) => `<tr>${td(m.master)}${td(String(m.count))}${td(`${fmt(m.revenue)} сум`)}</tr>`).join('')}</table>

<h2>Популярные зоны</h2>
<table><tr>${th('Зона')}${th('Раз в заявках')}</tr>
${metrics.topServices.map((s) => `<tr>${td(s.service)}${td(String(s.count))}</tr>`).join('')}</table>

<h2>Источники заявок</h2>
<table><tr>${th('Источник')}${th('Заявок')}${th('Выручка (выполненные)')}</tr>
${metrics.bySource.map((s) => `<tr>${td(s.source)}${td(String(s.count))}${td(`${fmt(s.revenue)} сум`)}</tr>`).join('')}</table>

<h2>Все заявки за период (${bookings.length})</h2>
<table><tr>${DETAIL_HEADERS.map(th).join('')}</tr>
${bookings.map((b) => `<tr>${bookingRow(b).map(td).join('')}</tr>`).join('')}</table>
</body></html>`;
}

/** .xls на базе HTML-таблиц — Excel открывает его напрямую (включая кириллицу). */
export function exportExcel(bookings: Booking[], metrics: ReportMetrics, periodLabel: string, filename: string): void {
  const blob = new Blob(['﻿' + reportHtml(bookings, metrics, periodLabel)], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  download(blob, `${filename}.xls`);
}

/** PDF через системный диалог печати (в нём выбирается «Сохранить как PDF»). */
export function exportPDF(bookings: Booking[], metrics: ReportMetrics, periodLabel: string): boolean {
  // Без токена noopener: с ним window.open по спецификации возвращает null,
  // и печать никогда не открывалась. Ссылку на opener снимаем вручную.
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return false;
  w.opener = null;
  w.document.write(reportHtml(bookings, metrics, periodLabel));
  w.document.close();
  w.focus();
  // Даём вёрстке отрисоваться перед вызовом печати.
  setTimeout(() => w.print(), 350);
  return true;
}
