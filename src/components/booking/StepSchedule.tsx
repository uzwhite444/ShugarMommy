import { Localized, Master, WorkWindow } from '../../types';
import { toIsoDate } from '../../data';
import type { DayAvailability } from '../../lib/availability';
import { MIN_DURATION_MIN, unionHoursOn } from './scheduleMath';
import { StepLabel } from './StepLabel';
import { TR } from './tr';

interface StepScheduleProps {
  t: (loc: Localized) => string;
  days: Date[];
  weekdayFmt: Intl.DateTimeFormat;
  date: string;
  setDate: (date: string) => void;
  selectedMaster: Master | undefined;
  eligibleMasters: readonly Master[];
  workHours: WorkWindow | null;
  loadingSlots: boolean;
  availability: DayAvailability | null;
  noHours: boolean;
  allTaken: boolean;
  slots: string[];
  takenSet: Set<string>;
  pastSet: Set<string>;
  tooLateSet: Set<string>;
  time: string;
  setTime: (time: string) => void;
  comboDuration: number;
}

const pillCls = (selected: boolean) =>
  `btn-press ink-rule rule-chip rule-short min-h-11 rounded-lg border px-1 text-sm font-medium ${
    selected
      ? 'border-ink bg-ink text-canvas'
      : 'border-hairline bg-canvas text-body hover:border-muted'
  }`;

/** Step 03 — date strip + time grid. */
export function StepSchedule({
  t,
  days,
  weekdayFmt,
  date,
  setDate,
  selectedMaster,
  eligibleMasters,
  workHours,
  loadingSlots,
  availability,
  noHours,
  allTaken,
  slots,
  takenSet,
  pastSet,
  tooLateSet,
  time,
  setTime,
  comboDuration,
}: StepScheduleProps) {
  return (
    <div>
      <StepLabel number="03">{t(TR.stepWhen)}</StepLabel>
      <div
        // overflow-x:auto forces overflow-y:auto, so the focus ring
        // (2px at 2px offset) needs real padding or it gets clipped.
        className="scrollbar-none -mx-1 mt-2 flex snap-x gap-2 overflow-x-auto p-1"
        role="group"
        aria-label={t(TR.stepWhen)}
      >
        {days.map((day, i) => {
          const iso = toIsoDate(day);
          const selected = date === iso;
          // Per-master calendars: a day is bookable only if the master
          // actually works it, or — for "любой мастер" — if anyone who
          // can do these zones does. Рената's Tue/Thu/Sat autumn rule
          // therefore greys out the rest of the week for her zones.
          const closed =
            unionHoursOn(selectedMaster ? [selectedMaster] : eligibleMasters, iso) === null;
          const topLabel = closed
            ? t(TR.dayOff)
            : i === 0
              ? t(TR.today)
              : i === 1
                ? t(TR.tomorrow)
                : weekdayFmt.format(day);
          return (
            <button
              key={iso}
              onClick={() => !closed && setDate(iso)}
              disabled={closed}
              aria-pressed={selected}
              className={`btn-press ink-rule rule-chip rule-short w-16 shrink-0 snap-start rounded-lg border py-2.5 text-center ${
                closed
                  ? 'cursor-not-allowed border-hairline/60 bg-surface/50 text-faint'
                  : selected
                    ? 'border-ink bg-ink text-canvas'
                    : 'border-hairline bg-canvas hover:border-muted'
              }`}
            >
              <span className={`block text-[11px] font-medium capitalize ${selected ? 'text-canvas/60' : 'text-faint'}`}>
                {topLabel}
              </span>
              <span className="mt-0.5 block font-serif text-xl font-semibold leading-none">
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-faint">{t(TR.dayOffNote)}</p>
      {/* Availability — and now the working window itself — change
          silently as the date or master is switched; the live region
          reads both out. */}
      <div aria-live="polite" aria-atomic="true">
        {workHours && (
          <p className="mt-2.5 text-xs font-medium text-muted">
            {t(TR.hoursNote)
              .replace('{from}', workHours.open)
              .replace('{to}', workHours.close)}
          </p>
        )}
        {loadingSlots && <p className="mt-3 text-xs text-faint">{t(TR.loadingSlots)}</p>}
        {availability?.dayClosed && (
          <p className="mt-3 text-xs font-semibold text-danger">{t(TR.dayClosed)}</p>
        )}
        {noHours && !availability?.dayClosed && (
          <p className="mt-3 text-xs font-semibold text-danger">{t(TR.masterDayOff)}</p>
        )}
        {allTaken && !availability?.dayClosed && (
          <p className="mt-3 text-xs font-semibold text-danger">{t(TR.noSlotsLeft)}</p>
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label={t(TR.stepWhen)}>
        {slots.map((slot) => {
          const taken = takenSet.has(slot) || pastSet.has(slot) || tooLateSet.has(slot);
          return (
            <button
              key={slot}
              onClick={() => !taken && setTime(slot)}
              disabled={taken}
              aria-pressed={time === slot}
              aria-label={taken ? `${slot} — ${t(TR.slotTaken)}` : slot}
              className={
                taken
                  ? 'min-h-11 cursor-not-allowed rounded-lg border border-hairline/60 bg-surface/50 px-1 text-sm font-medium text-faint line-through'
                  : pillCls(time === slot)
              }
            >
              {slot}
            </button>
          );
        })}
      </div>
      {/* Without this the late slots simply vanish for a long combo
          and the client thinks the day is fully booked. */}
      {comboDuration > MIN_DURATION_MIN && (
        <p className="mt-2.5 text-xs leading-relaxed text-faint">
          {t(TR.comboDuration).replace('{min}', String(comboDuration))}
        </p>
      )}
    </div>
  );
}
