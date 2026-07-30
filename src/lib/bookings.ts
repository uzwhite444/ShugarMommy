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
  customer_name: string;
  phone: string;
  services: string;
  master: string | null;
  visit_date: string;
  visit_time: string;
  total_price: number;
  comment: string | null;
}

/**
 * Persists a booking. Returns true on success, false when Supabase is not
 * configured or the insert failed — the Telegram handoff still happens either
 * way, so a backend hiccup never blocks the client.
 */
export async function createBooking(booking: NewBooking): Promise<boolean> {
  try {
    const supabase = await getClient();
    if (!supabase) return false;
    const { error } = await supabase.from('bookings').insert(booking);
    if (error) {
      console.error('createBooking failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('createBooking failed:', err);
    return false;
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
