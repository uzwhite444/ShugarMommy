/**
 * Slot availability: which times are already taken for a given date.
 * Combines confirmed/new bookings (via a privacy-safe RPC that returns only
 * time + master) with manual blocks the admin creates in the panel.
 */

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
      for (const row of bookings.data as Array<{ visit_time: string; master: string | null }>) {
        // A booking with no master picked occupies the slot for everyone —
        // the admin still has to assign somebody to it.
        if (row.master) addToMaster(result.takenByMaster, row.master, row.visit_time);
        else result.takenForAll.add(row.visit_time);
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
