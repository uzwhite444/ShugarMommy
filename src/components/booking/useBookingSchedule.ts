/**
 * Slot maths for the booking modal: fetches real availability for the picked
 * date and derives the per-master/per-date time grid from it (taken slots,
 * past-time slots, slots that would run past closing).
 *
 * `date`/`setDate`/`time`/`setTime` are owned by the caller (BookingModal) —
 * this hook only reads and clears them, it never introduces its own copy, so
 * the rest of the form keeps a single source of truth for what is selected.
 */
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { Master, WorkWindow } from '../../types';
import { masterHoursOn, masterKey, toIsoDate } from '../../data';
import {
  fetchDayAvailability,
  isRangeTaken,
  timeToMinutes,
  type DayAvailability,
} from '../../lib/availability';
import { buildTimeSlots, unionHoursOn, widestHours } from './scheduleMath';

interface UseBookingScheduleArgs {
  date: string;
  setDate: (date: string) => void;
  time: string;
  setTime: (time: string) => void;
  selectedMaster: Master | undefined;
  eligibleMasters: readonly Master[];
  comboDuration: number;
  selectedMasterName: string | null;
}

export interface BookingSchedule {
  availability: DayAvailability | null;
  /**
   * Exposed so the caller can push a freshly-fetched snapshot straight into
   * this hook's state after a submit-time recheck finds the slot just taken —
   * without this, that recheck could not make the grid reflect what it found.
   */
  setAvailability: Dispatch<SetStateAction<DayAvailability | null>>;
  loadingSlots: boolean;
  workHours: WorkWindow | null;
  roster: string[];
  slots: string[];
  takenSet: Set<string>;
  tooLateSet: Set<string>;
  pastSet: Set<string>;
  allTaken: boolean;
  noHours: boolean;
}

export function useBookingSchedule({
  date,
  setDate,
  time,
  setTime,
  selectedMaster,
  eligibleMasters,
  comboDuration,
  selectedMasterName,
}: UseBookingScheduleArgs): BookingSchedule {
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Load real availability whenever the customer picks a date. A stale flag
  // guards against out-of-order responses when dates are switched quickly.
  useEffect(() => {
    if (!date) {
      setAvailability(null);
      return;
    }
    let stale = false;
    // Drop the previous day's slots first — otherwise the grid keeps showing
    // them (and lets them be picked) until the new fetch resolves.
    setAvailability(null);
    setTime('');
    setLoadingSlots(true);
    fetchDayAvailability(date).then((data) => {
      if (stale) return;
      setAvailability(data);
      setLoadingSlots(false);
    });
    return () => {
      stale = true;
    };
  }, [date, setTime]);

  // Opening window that actually applies: one master's own hours once she is
  // chosen, the union of everyone on shift for "любой мастер". Before a date is
  // picked there is no rule to apply yet, so the widest window previews the grid.
  const workHours = useMemo<WorkWindow | null>(() => {
    const masters = selectedMaster ? [selectedMaster] : eligibleMasters;
    if (!date) return widestHours(masters);
    return unionHoursOn(masters, date);
  }, [date, selectedMaster, eligibleMasters]);

  // Masters on shift that date — without it "любой мастер" is blacked out as
  // soon as a single master is busy. Only the eligible ones count: a slot that
  // is free solely because Муслима is idle is not free for a face zone.
  const roster = useMemo(
    () => (date ? eligibleMasters.filter((m) => masterHoursOn(m, date)).map(masterKey) : []),
    [date, eligibleMasters],
  );

  const slots = useMemo(() => buildTimeSlots(workHours), [workHours]);
  const takenSet = useMemo(() => {
    if (!availability) return new Set<string>();
    return new Set(
      slots.filter((slot) =>
        isRangeTaken(availability, slot, selectedMasterName, comboDuration, roster),
      ),
    );
  }, [availability, slots, selectedMasterName, comboDuration, roster]);

  // A long combo cannot start so late that it would run past closing.
  const tooLateSet = useMemo(() => {
    if (!workHours) return new Set<string>();
    const close = timeToMinutes(workHours.close);
    return new Set(slots.filter((slot) => timeToMinutes(slot) + comboDuration > close));
  }, [slots, comboDuration, workHours]);

  // When "today" is picked, times that already passed cannot be booked.
  const pastSet = useMemo(() => {
    if (!date || date !== toIsoDate(new Date())) return new Set<string>();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return new Set(
      slots.filter((slot) => {
        const [h, m] = slot.split(':').map(Number);
        return h * 60 + m <= nowMin;
      }),
    );
  }, [date, slots]);

  // Switching to a master who is busy at the chosen time — or whose day simply
  // starts later, so the slot is no longer in her grid at all — clears the
  // choice, so an unbookable time can never be submitted.
  useEffect(() => {
    if (!time) return;
    if (!slots.includes(time) || takenSet.has(time) || pastSet.has(time) || tooLateSet.has(time)) {
      setTime('');
    }
  }, [slots, takenSet, pastSet, tooLateSet, time, setTime]);

  // Each master keeps her own calendar, so a date that was open for "любой
  // мастер" can be a day off for the one just picked. Drop it rather than send
  // a request for a day nobody works.
  useEffect(() => {
    if (!date) return;
    const masters = selectedMaster ? [selectedMaster] : eligibleMasters;
    if (unionHoursOn(masters, date) === null) setDate('');
  }, [selectedMaster, eligibleMasters, date, setDate]);

  const allTaken =
    Boolean(date) &&
    !loadingSlots &&
    slots.length > 0 &&
    slots.every((slot) => takenSet.has(slot) || pastSet.has(slot) || tooLateSet.has(slot));

  // The chosen master does not work that date at all (the auto-reset above
  // normally gets there first — this is the belt-and-braces message).
  const noHours = Boolean(date) && !loadingSlots && slots.length === 0;

  return {
    availability,
    setAvailability,
    loadingSlots,
    workHours,
    roster,
    slots,
    takenSet,
    tooLateSet,
    pastSet,
    allTaken,
    noHours,
  };
}
