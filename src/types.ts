export type LanguageCode = 'RU' | 'UZ' | 'EN';

/** A string translated into every supported language. */
export type Localized = Record<LanguageCode, string>;

export type ZoneCategory = 'face' | 'arms' | 'legs' | 'bikini' | 'body';

/** One depilation zone in the price list / calculator. */
export interface ServiceZone {
  id: string;
  category: ZoneCategory;
  name: Localized;
  /** Price in UZS. */
  price: number;
  /** Approximate procedure duration in minutes. */
  durationMin: number;
  popular?: boolean;
}

export interface Master {
  id: string;
  /**
   * Display name per language (RU Cyrillic, UZ/EN Latin transliteration).
   * INVARIANT: `name.RU` is the canonical key — it is what gets written to
   * bookings.master / blocked_slots.master, matched against takenByMaster in
   * lib/availability.ts and shown in the admin panel. It must be identical in
   * every language, otherwise availability matching and existing rows break.
   * Use masterKey() from data.ts for storage, getLocalized() for display.
   */
  name: Localized;
  role: Localized;
  experienceYears: number;
  description: Localized;
  /** Initials shown in the avatar placeholder until a real photo is added. */
  initials: string;
  /**
   * Discount off the base price list, in percent. Base prices belong to the
   * top master; junior masters work at a lower rate.
   */
  discountPct: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: Localized;
  service: Localized;
}

export interface FaqItem {
  question: Localized;
  answer: Localized;
}

export type BookingStatus = 'new' | 'confirmed' | 'done' | 'cancelled';

/** A booking row as stored in Supabase. */
export interface Booking {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  services: string;
  master: string | null;
  visit_date: string;
  visit_time: string;
  total_price: number;
  comment: string | null;
  status: BookingStatus;
  /** Traffic channel the booking came from (requires 05_source.sql). */
  source?: string | null;
  /**
   * Visit length in minutes (requires 09_visit_duration.sql). Absent on rows
   * created before that migration — treat as 30.
   */
  duration_min?: number | null;
}
