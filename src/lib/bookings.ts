import { Booking, BookingStatus } from '../types';

/**
 * The Supabase client is imported dynamically so @supabase/supabase-js stays
 * out of the initial landing bundle (~100 kB min) — visitors download it only
 * when a booking is actually submitted (or in the admin chunk).
 */
async function getClient() {
  const { supabase } = await import('./supabase');
  return supabase;
}

export interface NewBooking {
  /** Set client-side so the confirmation screen can reference the booking. */
  id?: string;
  customer_name: string;
  phone: string;
  services: string;
  master: string | null;
  visit_date: string;
  visit_time: string;
  total_price: number;
  comment: string | null;
  source?: string | null;
  /** Visit length in minutes — blocks every cell it covers (09_visit_duration.sql). */
  duration_min?: number | null;
}

/**
 * Outcome of an insert. The caller must not show a success screen for
 * 'slot-taken' / 'rate-limited': the database rejected those bookings.
 */
export type BookingResult =
  | { status: 'ok'; id: string | null }
  /** bookings_slot_uniq fired — somebody took the slot first. */
  | { status: 'slot-taken' }
  /** The antiflood trigger refused: too many bookings for this phone. */
  | { status: 'rate-limited' }
  /** Supabase unreachable or misconfigured — nothing was rejected. */
  | { status: 'unavailable' };

interface InsertError {
  code?: string;
  message: string;
}

/** Columns added by later migrations; absent on a database that lags behind. */
const OPTIONAL_COLUMNS = ['source', 'duration_min'] as const;

/**
 * Which optional columns the backend does not know about. PostgREST reports an
 * unknown column as PGRST204 and names it in the message; when it does not,
 * every optional column is dropped so the booking still lands.
 */
function missingOptionalColumns(error: InsertError): string[] {
  if (error.code !== 'PGRST204' && !/schema cache/i.test(error.message)) return [];
  const named = OPTIONAL_COLUMNS.filter((column) => error.message.includes(column));
  return named.length > 0 ? named : [...OPTIONAL_COLUMNS];
}

function classifyInsertError(error: InsertError): BookingResult {
  // 23505 = unique_violation: the bookings_slot_uniq index rejected a second
  // active booking for the same date + time + master.
  if (error.code === '23505') return { status: 'slot-taken' };
  // P0001 = raise_exception from the antiflood trigger (08_hardening_v3.sql).
  if (error.code === 'P0001' && /booking limit/i.test(error.message)) {
    return { status: 'rate-limited' };
  }
  console.error('createBooking failed:', error.message);
  return { status: 'unavailable' };
}

/**
 * Saves the booking and returns its id, which the confirmation screen uses to
 * offer a Telegram reminder. The id is generated client-side because RLS lets
 * anonymous visitors insert but not read back. A rejected booking is reported
 * as such; 'unavailable' keeps the forgiving path (the Telegram handoff still
 * happens), so a backend hiccup never costs the studio a client.
 */
export async function createBooking(booking: NewBooking): Promise<BookingResult> {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined;
  try {
    const supabase = await getClient();
    if (!supabase) return { status: 'unavailable' };
    const row: Record<string, unknown> = id ? { ...booking, id } : { ...booking };
    const { error } = await supabase.from('bookings').insert(row);
    if (!error) return { status: 'ok', id: id ?? null };

    // `source` (05_source.sql) and `duration_min` (09_visit_duration.sql) are
    // optional. If a migration has not been applied yet, retry without those
    // columns rather than losing the booking.
    const missing = missingOptionalColumns(error);
    if (missing.length > 0) {
      const retryRow = { ...row };
      for (const column of missing) delete retryRow[column];
      const retry = await supabase.from('bookings').insert(retryRow);
      if (!retry.error) return { status: 'ok', id: id ?? null };
      return classifyInsertError(retry.error);
    }

    return classifyInsertError(error);
  } catch (err) {
    console.error('createBooking failed:', err);
    return { status: 'unavailable' };
  }
}

/** All bookings, newest first. Admin-only (RLS blocks anonymous reads). */
export async function fetchBookings(): Promise<Booking[]> {
  try {
    const supabase = await getClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      console.error('fetchBookings failed:', error.message);
      return [];
    }
    return (data as Booking[]) ?? [];
  } catch (err) {
    console.error('fetchBookings failed:', err);
    return [];
  }
}

/**
 * Cancels the customer's own bookings for a date, identified by phone.
 * Returns how many were cancelled, or null if the feature is not installed
 * (supabase/06_cancel.sql) so the UI can fall back to "call us".
 */
export async function cancelBookingByPhone(phone: string, date: string): Promise<number | null> {
  try {
    const supabase = await getClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('cancel_booking', {
      customer_phone: phone,
      target_date: date,
    });
    if (error) {
      console.error('cancelBooking failed:', error.message);
      return null;
    }
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    console.error('cancelBooking failed:', err);
    return null;
  }
}

/** Removes a booking entirely (requires supabase/03_admin_delete.sql). */
export async function deleteBooking(id: string): Promise<boolean> {
  try {
    const supabase = await getClient();
    if (!supabase) return false;
    const { error, count } = await supabase
      .from('bookings')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) {
      console.error('deleteBooking failed:', error.message);
      return false;
    }
    // RLS without a delete policy silently deletes 0 rows — treat as failure.
    return (count ?? 0) > 0;
  } catch (err) {
    console.error('deleteBooking failed:', err);
    return false;
  }
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<boolean> {
  try {
    const supabase = await getClient();
    if (!supabase) return false;
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) {
      console.error('updateBookingStatus failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateBookingStatus failed:', err);
    return false;
  }
}
