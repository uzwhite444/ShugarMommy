export type LanguageCode = 'RU' | 'UZ' | 'EN';

/** A string translated into every supported language. */
export type Localized = Record<LanguageCode, string>;

export type ZoneCategory = 'face' | 'arms' | 'legs' | 'bikini' | 'body';

/** One depilation zone in the price list / calculator. */
export interface ServiceZone {
  id: string;
  category: ZoneCategory;
  /** Official studio wording — never paraphrase it in the UI. */
  name: Localized;
  /**
   * Studio price in UZS, or null when the studio has not given one yet
   * ("цена по запросу"). INVARIANT: a null price never enters any total —
   * calcTotal() returns those zones separately in `onRequestZones`.
   */
  price: number | null;
  /**
   * Kept out of the public price list. Set on the face zones until the studio
   * supplies their prices — the data stays here so one flag brings them back.
   */
  hidden?: boolean;
  /**
   * "Хит" badge. The studio has not marked any zone yet, so nothing sets it —
   * the field stays so the badge can be switched on without a type change.
   */
  popular?: boolean;
}

/**
 * One stretch of a master's working calendar. A master's schedule is a list of
 * these; the rule in force is chosen by the VISIT date, never by "today", so a
 * September visit booked in August already uses the September rule.
 */
export interface MasterScheduleRule {
  /**
   * Local ISO date (YYYY-MM-DD) this rule starts applying, or null for the
   * rule that applies before any dated one.
   */
  effectiveFrom: string | null;
  /** Worked weekdays as Date.getDay(): 0 = Sunday … 6 = Saturday. */
  weekdays: readonly number[];
  /** "HH:MM" local (Asia/Tashkent). */
  open: string;
  /** "HH:MM" local (Asia/Tashkent). */
  close: string;
}

/** An opening window for one day. */
export interface WorkWindow {
  open: string;
  close: string;
}

export interface Master {
  id: string;
  /**
   * Display name per language (RU Cyrillic, UZ/EN Latin transliteration).
   * INVARIANT: `name.RU` is the canonical key — it is what gets written to
   * bookings.master / blocked_slots.master, matched against takenByMaster in
   * lib/availability.ts and shown in the admin panel. It must never change for
   * an existing master, or availability matching and existing rows break.
   * Use masterKey() from data.ts for storage, getLocalized() for display.
   */
  name: Localized;
  /** Line under the name: «Топ-мастер» / «Сертифицированный мастер». */
  title: Localized;
  /** Extra credential line — present only where the studio stated one. */
  credentials?: Localized;
  /**
   * Only set where the studio actually gave a number. Absent means the studio
   * did not state it — never substitute a guess.
   */
  experienceYears?: number;
  /** Hidden from the public site; kept in data so one flag brings her back. */
  hidden?: boolean;
  /** Zone ids this master performs. */
  zoneIds: readonly string[];
  /**
   * zoneId → price in UZS. A missing key means this master has no price for
   * that zone yet → "по запросу". There is no discount mechanic: each master
   * simply carries her own price list.
   */
  prices: Readonly<Record<string, number | undefined>>;
  /** Schedule rules; order does not matter, the visit date picks one. */
  schedule: readonly MasterScheduleRule[];
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
