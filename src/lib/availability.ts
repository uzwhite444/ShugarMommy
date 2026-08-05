/**
 * Slot availability: which times are already taken for a given date.
 * Combines confirmed/new bookings (via a privacy-safe RPC that returns only
 * time + master + duration) with manual blocks the admin creates in the panel.
 */

/** The booking grid is built from 30-minute cells. */
const SLOT_MINUTES = 30;

/** Rows created before 09_visit_duration.sql carry no duration. */
const DEFAULT_DURATION_MIN = 30;

/** A single visit can never occupy more than one working day. */
const MAX_DURATION_MIN = 12 * 60;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
}

function minutesToTime(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Every 30-minute cell a visit of `durationMin` starting at `start` occupies.
 * A visit that starts mid-cell still blocks that whole cell, so the first cell
 * is floored to the grid.
 */
export function coveredSlots(start: string, durationMin: number): string[] {
  const from = timeToMinutes(start);
  if (!Number.isFinite(from)) return [];
  const span = Math.min(Math.max(durationMin || DEFAULT_DURATION_MIN, SLOT_MINUTES), MAX_DURATION_MIN);
  const slots: string[] = [];
  for (let t = Math.floor(from / SLOT_MINUTES) * SLOT_MINUTES; t < from + span; t += SLOT_MINUTES) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

async function getClient() {
  const { supabase } = await import('./supabase');
  return supabase;
}

export interface BlockedSlot {
  id: string;
  block_date: string;
  /** null = the whole day is blocked. */
  block_time: string | null;
  master: string | null;
  reason: string | null;
}

export interface DayAvailability {
  /** Times taken for every master (whole-day blocks or generic bookings). */
  takenForAll: Set<string>;
  /** master name → times taken for that specific master. */
  takenByMaster: Map<string, Set<string>>;
  /** True when the admin blocked the entire day. */
  dayClosed: boolean;
}

const emptyDay = (): DayAvailability => ({
  takenForAll: new Set(),
  takenByMaster: new Map(),
  dayClosed: false,
});

function addToMaster(map: Map<string, Set<string>>, master: string, time: string): void {
  const set = map.get(master) ?? new Set<string>();
  set.add(time);
  map.set(master, set);
}

/**
 * Loads availability for one date. Never throws — on any failure it returns
 * an empty result so the form stays usable (the admin confirms manually).
 */
export async function fetchDayAvailability(date: string): Promise<DayAvailability> {
  const result = emptyDay();
  try {
    const supabase = await getClient();
    if (!supabase) return result;

    const [bookings, blocks] = await Promise.all([
      supabase.rpc('booked_slots', { target_date: date }),
      supabase.from('blocked_slots').select('block_time, master').eq('block_date', date),
    ]);

    if (!bookings.error && Array.isArray(bookings.data)) {
      const rows = bookings.data as Array<{
        visit_time: string;
        master: string | null;
        duration_min?: number | null;
      }>;
      for (const row of rows) {
        // A 50-minute visit covers two cells, a 90-minute one covers three.
        for (const slot of coveredSlots(row.visit_time, row.duration_min ?? DEFAULT_DURATION_MIN)) {
          // A booking with no master picked occupies the slot for everyone —
          // the admin still has to assign somebody to it.
          if (row.master) addToMaster(result.takenByMaster, row.master, slot);
          else result.takenForAll.add(slot);
        }
      }
    }

    if (!blocks.error && Array.isArray(blocks.data)) {
      for (const row of blocks.data as Array<{ block_time: string | null; master: string | null }>) {
        if (row.block_time === null) {
          result.dayClosed = true;
          continue;
        }
        if (row.master) addToMaster(result.takenByMaster, row.master, row.block_time);
        else result.takenForAll.add(row.block_time);
      }
    }
  } catch (err) {
    console.error('fetchDayAvailability failed:', err);
  }
  return result;
}

/** True when `time` cannot be booked for the chosen master. */
export function isSlotTaken(availability: DayAvailability, time: string, masterName: string | null): boolean {
  if (availability.dayClosed) return true;
  if (availability.takenForAll.has(time)) return true;
  if (masterName) return availability.takenByMaster.get(masterName)?.has(time) ?? false;
  // "Any master" is only blocked when every master is busy at that time.
  const masters = [...availability.takenByMaster.values()];
  return masters.length > 0 && masters.every((set) => set.has(time));
}

/**
 * True when a visit of `durationMin` starting at `time` collides with anything.
 * A 90-minute combo starting at 10:00 needs 10:00, 10:30 and 11:00 free.
 */
export function isRangeTaken(
  availability: DayAvailability,
  time: string,
  masterName: string | null,
  durationMin: number,
): boolean {
  return coveredSlots(time, durationMin).some((slot) => isSlotTaken(availability, slot, masterName));
}

// --- Admin-side management -------------------------------------------------

export async function fetchBlockedSlots(fromDate: string): Promise<BlockedSlot[]> {
  try {
    const supabase = await getClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('blocked_slots')
      .select('*')
      .gte('block_date', fromDate)
      .order('block_date', { ascending: true });
    if (error) {
      console.error('fetchBlockedSlots failed:', error.message);
      return [];
    }
    return (data as BlockedSlot[]) ?? [];
  } catch (err) {
    console.error('fetchBlockedSlots failed:', err);
    return [];
  }
}

export async function createBlock(block: {
  block_date: string;
  block_time: string | null;
  master: string | null;
  reason: string | null;
}): Promise<boolean> {
  try {
    const supabase = await getClient();
    if (!supabase) return false;
    const { error } = await supabase.from('blocked_slots').insert(block);
    if (error) {
      console.error('createBlock failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('createBlock failed:', err);
    return false;
  }
}

export async function deleteBlock(id: string): Promise<boolean> {
  try {
    const supabase = await getClient();
    if (!supabase) return false;
    const { error, count } = await supabase
      .from('blocked_slots')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) {
      console.error('deleteBlock failed:', error.message);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (err) {
    console.error('deleteBlock failed:', err);
    return false;
  }
}
