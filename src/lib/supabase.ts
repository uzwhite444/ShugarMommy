import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client.
 *
 * Reads credentials from env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * If they are not set, `supabase` is null and `isSupabaseConfigured` is false —
 * bookings then go to Telegram only, so the site keeps working before the
 * backend is wired up.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
