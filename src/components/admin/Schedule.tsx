import { useCallback, useEffect, useState } from 'react';
import { CalendarOff, Loader2, Plus, Trash2 } from 'lucide-react';
import { BlockedSlot, createBlock, deleteBlock, fetchBlockedSlots } from '../../lib/availability';
import { MASTERS, masterKey } from '../../data';
import { STUDIO_HOURS } from '../../utils';
import { Booking } from '../../types';
import { todayIso } from './status';

interface ScheduleProps {
  bookings: Booking[];
}

/** 30-minute slots between opening and closing. */
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  const [openH] = STUDIO_HOURS.open.split(':').map(Number);
  const [closeH] = STUDIO_HOURS.close.split(':').map(Number);
  for (let h = openH; h < closeH; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

const SLOTS = buildTimeSlots();

export default function Schedule({ bookings }: ScheduleProps) {
  const [blocks, setBlocks] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [slot, setSlot] = useState<string>('all');
  const [master, setMaster] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setBlocks(await fetchBlockedSlots(todayIso()));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!date) return;
    setSaving(true);
    const ok = await createBlock({
      block_date: date,
      block_time: slot === 'all' ? null : slot,
      master: master || null,
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (ok) {
      setReason('');
      load();
    } else {
      window.alert(
        'Не удалось сохранить. Если блокировки ещё не включены — выполните supabase/04_availability.sql в Supabase SQL Editor.',
      );
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteBlock(id);
    if (ok) setBlocks((prev) => prev.filter((b) => b.id !== id));
    else load();
  };

  // Bookings already occupy slots automatically — show them read-only so the
  // admin sees the full picture of the selected day.
  const dayBookings = bookings
    .filter((b) => b.visit_date === date && b.status !== 'cancelled')
    .sort((a, b) => a.visit_time.localeCompare(b.visit_time));

  const fieldCls =
    'field rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      {/* Add a block */}
      <div className="rounded-xl bg-surface p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          <CalendarOff size={13} /> Закрыть время
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Обед, отпуск, личные дела — закрытое время исчезнет из формы записи на сайте.
        </p>

        <div className="mt-4 space-y-2.5">
          <input
            type="date"
            value={date}
            min={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className={`w-full ${fieldCls}`}
            aria-label="Дата"
          />
          <select value={slot} onChange={(e) => setSlot(e.target.value)} className={`w-full ${fieldCls}`} aria-label="Время">
            <option value="all">Весь день</option>
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={master} onChange={(e) => setMaster(e.target.value)} className={`w-full ${fieldCls}`} aria-label="Мастер">
            <option value="">Все мастера</option>
            {/* The value is the canonical RU spelling stored in the database —
                never a localized one, or the block stops matching bookings. */}
            {MASTERS.map((m) => (
              <option key={m.id} value={masterKey(m)}>
                {m.name.RU}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина (необязательно)"
            maxLength={200}
            className={`w-full ${fieldCls}`}
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            className="btn-press press-slab flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Закрыть время
          </button>
        </div>

        {/* Day preview */}
        <div className="mt-6 border-t border-hairline pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Записи на {date}</p>
          {dayBookings.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Записей нет.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {dayBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{b.visit_time}</span>
                  <span className="truncate pl-3 text-muted">
                    {b.customer_name}
                    {b.master ? ` · ${b.master}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Existing blocks */}
      <div className="rounded-xl bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Закрытое время</p>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-primary" />
          </div>
        ) : blocks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Пока ничего не закрыто — сайт показывает всё рабочее время.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {new Date(b.block_date + 'T00:00:00').toLocaleDateString('ru-RU', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                    })}
                    {' · '}
                    {b.block_time ?? 'весь день'}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {b.master ?? 'Все мастера'}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  aria-label="Снять блокировку"
                  title="Снять блокировку"
                  className="press-inner shrink-0 rounded-lg border border-hairline p-1.5 text-muted transition-colors hover:border-danger hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
