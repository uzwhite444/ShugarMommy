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
}

/**
 * Persists a booking. Returns true on success, false when Supabase is not
 * configured or the insert failed — the Telegram handoff still happens either
 * way, so a backend hiccup never blocks the client.
 */
/**
 * Saves the booking and returns its id, which the confirmation screen uses to
 * offer a Telegram reminder. The id is generated client-side because RLS lets
 * anonymous visitors insert but not read back. Returns null when the backend
 * is unavailable — the Telegram handoff still happens, so nothing is lost.
 */
export async function createBooking(booking: NewBooking): Promise<string | null> {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined;
  try {
    const supabase = await getClient();
    if (!supabase) return null;
    const row = id ? { ...booking, id } : booking;
    const { error } = await supabase.from('bookings').insert(row);
    if (!error) return id ?? null;

    // `source` is optional (added by 05_source.sql). If that migration has
    // not been applied yet, retry without it rather than losing the booking.
    const missingColumn = error.code === 'PGRST204' || /source/i.test(error.message);
    if (missingColumn && booking.source !== undefined) {
      const { source: _omitted, ...rest } = row;
      const retry = await supabase.from('bookings').insert(rest);
      if (!retry.error) return id ?? null;
      console.error('createBooking retry failed:', retry.error.message);
      return null;
    }

    console.error('createBooking failed:', error.message);
    return null;
  } catch (err) {
    console.error('createBooking failed:', err);
    return null;
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
