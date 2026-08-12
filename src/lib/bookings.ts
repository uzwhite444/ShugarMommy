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
  /**
   * What was selected — NOT what it costs. The price and the visit length are
   * computed by the database from these ids (supabase/12_server_pricing.sql):
   * a total that arrives from the browser can be anything, and the admin
   * panel's revenue and reports treat it as the truth.
   */
  zone_ids: string[];
  comment: string | null;
  source?: string | null;
}

/**
 * Outcome of an insert. The caller must not show a success screen for
 * 'slot-taken' / 'rate-limited': the database rejected those bookings.
 */
export type BookingResult =
  | {
      status: 'ok';
      id: string | null;
      /** What the SERVER charged. Compare with the figure on screen — see warnOnPriceDrift(). */
      totalPrice: number | null;
      durationMin: number | null;
    }
  /** bookings_slot_uniq fired — somebody took the slot first. */
  | { status: 'slot-taken' }
  /** The antiflood trigger refused: too many bookings for this phone. */
  | { status: 'rate-limited' }
  /** A CHECK constraint refused the row — today only a phone under 7 digits. */
  | { status: 'invalid' }
  /** Supabase unreachable or misconfigured — nothing was rejected. */
  | { status: 'unavailable' };

interface InsertError {
  code?: string;
  message: string;
}

function classifyInsertError(error: InsertError): BookingResult {
  // 23505 = unique_violation: the bookings_slot_uniq index rejected a second
  // active booking for the same date + time + master.
  if (error.code === '23505') return { status: 'slot-taken' };
  // P0001 = raise_exception from the antiflood trigger (08_hardening_v3.sql).
  if (error.code === 'P0001' && /booking limit/i.test(error.message)) {
    return { status: 'rate-limited' };
  }
  // 23514 = check_violation. Falling through to 'unavailable' would send the
  // client to the success screen with no row saved — the studio would see the
  // Telegram message but the site would have no booking, no slot held and no
  // reminder. A rejected row must never read as a placed booking.
  if (error.code === '23514') {
    console.error('createBooking rejected by a CHECK constraint:', error.message);
    return { status: 'invalid' };
  }
  // Everything else is 'unavailable' — including PGRST202, which is what
  // PostgREST answers while supabase/12_server_pricing.sql has not been run
  // yet. Nothing was rejected there either: the request never reached a
  // working backend, so the forgiving Telegram path is the right one.
  console.error('createBooking failed:', error.message);
  return { status: 'unavailable' };
}

/** What create_booking() answers with — see supabase/12_server_pricing.sql. */
interface CreatedBooking {
  id?: string;
  master?: string | null;
  total_price?: number;
  duration_min?: number;
}

/**
 * Saves the booking and returns its id, which the confirmation screen uses to
 * offer a Telegram reminder. The id is generated client-side because RLS lets
 * anonymous visitors insert but not read back. A rejected booking is reported
 * as such; 'unavailable' keeps the forgiving path (the Telegram handoff still
 * happens), so a backend hiccup never costs the studio a client.
 *
 * The row is written by the create_booking() function rather than by a direct
 * insert: the price and the visit length are the database's to decide, and the
 * table no longer accepts anonymous inserts at all. The function is a plain
 * insert underneath, so the antiflood trigger, the slot uniqueness index and
 * their SQLSTATEs reach us exactly as before — which is why the outcomes below
 * still tell "taken" from "too many" from "rejected".
 */
export async function createBooking(booking: NewBooking): Promise<BookingResult> {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined;
  try {
    const supabase = await getClient();
    if (!supabase) return { status: 'unavailable' };
    // Every argument is passed explicitly, including the null ones: PostgREST
    // matches a function by the set of keys it receives, and an omitted key
    // would make it answer "no such function" instead of calling this one.
    const { data, error } = await supabase.rpc('create_booking', {
      p_id: id ?? null,
      p_customer_name: booking.customer_name,
      p_phone: booking.phone,
      p_services: booking.services,
      p_master: booking.master,
      p_visit_date: booking.visit_date,
      p_visit_time: booking.visit_time,
      p_zone_ids: booking.zone_ids,
      p_comment: booking.comment,
      p_source: booking.source ?? null,
    });
    if (error) return classifyInsertError(error);

    const saved = (data ?? null) as CreatedBooking | null;
    return {
      status: 'ok',
      id: saved?.id ?? id ?? null,
      totalPrice: typeof saved?.total_price === 'number' ? saved.total_price : null,
      durationMin: typeof saved?.duration_min === 'number' ? saved.duration_min : null,
    };
  } catch (err) {
    console.error('createBooking failed:', err);
    return { status: 'unavailable' };
  }
}

/**
 * Shouts into the console when the price the client showed is not the price the
 * database charged. There is only one way for those to differ: the price list
 * in the database has fallen behind src/data.ts — i.e. supabase/12_server_pricing.sql
 * was regenerated but never run. Nothing is shown to the visitor: the figure she
 * read is the one the studio will honour, and an alarming banner would cost a
 * booking over an accounting discrepancy.
 */
export function warnOnPriceDrift(shown: number, result: BookingResult): void {
  if (result.status !== 'ok' || result.totalPrice === null) return;
  if (result.totalPrice === shown) return;
  console.error(
    `Цена разошлась: сайт показал ${shown}, база записала ${result.totalPrice}. ` +
      'Прайс в базе отстал от src/data.ts — выполните supabase/12_server_pricing.sql.',
  );
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
 * How many characters of the booking id make up the cancellation code.
 * Eight is the first UUID group — 16^8 ≈ 4.3 billion codes, which the server
 * additionally pairs with the phone and throttles to 5 misses per 15 minutes
 * (supabase/11_cancel_by_code.sql). Short enough to read out over the phone.
 */
const CODE_LENGTH = 8;

/**
 * Reduces anything the customer might paste — "3F7A-9C21", "3f7a 9c21", the
 * whole booking id out of a link — to the bare lowercase hex code the server
 * compares. Returns '' when there are not enough hex characters to be a code,
 * so a typo is caught before it costs a throttled attempt.
 */
export function normalizeBookingCode(raw: string): string {
  const hex = raw.toLowerCase().replace(/[^0-9a-f]/g, '');
  return hex.length >= CODE_LENGTH ? hex.slice(0, CODE_LENGTH) : '';
}

/** The code as it is shown and dictated: `3F7A-9C21`. Null when there is none. */
export function formatBookingCode(id: string | null): string | null {
  if (!id) return null;
  const hex = normalizeBookingCode(id);
  if (!hex) return null;
  return `${hex.slice(0, 4)}-${hex.slice(4)}`.toUpperCase();
}

/**
 * Outcome of a cancellation attempt. 'mismatch' deliberately covers every
 * "it did not match" case — wrong code, wrong phone, already cancelled — so
 * the form cannot be used to find out which of them is true.
 */
export type CancelResult = 'ok' | 'mismatch' | 'throttled' | 'unavailable';

/**
 * Cancels one booking, identified by its code AND the phone it was made with.
 * Both are required: a forwarded reminder link carries the code alone and
 * cancels nothing. 'unavailable' means the request never reached a working
 * backend (offline, or supabase/11_cancel_by_code.sql not applied yet), so the
 * UI must fall back to "call us" instead of claiming the booking is still on.
 */
export async function cancelBookingByCode(code: string, phone: string): Promise<CancelResult> {
  try {
    const supabase = await getClient();
    if (!supabase) return 'unavailable';
    const { data, error } = await supabase.rpc('cancel_booking_by_code', {
      booking_code: code,
      customer_phone: phone,
    });
    if (error) {
      console.error('cancelBookingByCode failed:', error.message);
      return 'unavailable';
    }
    if (data === 'ok') return 'ok';
    if (data === 'throttled') return 'throttled';
    return 'mismatch';
  } catch (err) {
    console.error('cancelBookingByCode failed:', err);
    return 'unavailable';
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
