export type LanguageCode = 'RU' | 'UZ' | 'EN';

/** A string translated into every supported language. */
export type Localized = Record<LanguageCode, string>;

/**
 * `brows` and `polymer` are NOT sugaring — they are separate techniques Рената
 * performs, and the studio prices them differently from the sugaring zone of
 * the same name (see the polymer zones in data.ts). They are their own
 * categories precisely so the price list can never present them as sugaring.
 */
export type ZoneCategory =
  | 'face'
  | 'arms'
  | 'legs'
  | 'bikini'
  | 'body'
  | 'brows'
  | 'polymer';

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
   * Kept out of the public price list. Nothing sets it today — the face zones
   * were unhidden once Рената's prices arrived. The flag stays so a zone can be
   * pulled from the site without deleting its data (and its share links).
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

/**
 * A master's combo discount: pick `minZones` PRICED zones or more with her and
 * `pct` comes off the subtotal.
 *
 * INVARIANT: this is a property of the MASTER, not of the studio. Ангелина and
 * Муслима give −20% from 3 zones; Рената gives no percentage discount at all —
 * her offer is the fixed sets below. A discount must therefore never be quoted
 * before a master is chosen (see calcTotal in utils.ts).
 */
export interface MasterDiscount {
  minZones: number;
  pct: number;
}

/**
 * A fixed-price bundle: take exactly these zones with this master and pay
 * `price` instead of the sum of her per-zone prices.
 *
 * Deliberately has NO name field. The title a client reads is composed from the
 * zone names via findZone(), so the set card and the price list can never drift
 * apart, and the composition stays correct in all three languages for free.
 */
export interface ServiceSet {
  id: string;
  /** Exact composition. A selection matches only when it is these ids and nothing else. */
  zoneIds: readonly string[];
  /** Fixed studio price in UZS. Always lower than the sum of the master's zone prices. */
  price: number;
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
   * Experience in WHOLE MONTHS, only where the studio gave a number. Absent
   * means the studio did not state it — never substitute a guess.
   *
   * Months, not years, because Муслима's stated experience is 6 months and a
   * fractional `experienceYears: 0.5` would render as "0.5 года". The field was
   * renamed rather than reused so that no caller can keep reading a month count
   * as years — the rename is what makes the change a compile error.
   * Display goes through formatExperience() in utils.ts.
   */
  experienceMonths?: number;
  /** Hidden from the public site; kept in data so one flag brings her back. */
  hidden?: boolean;
  /** Zone ids this master performs. */
  zoneIds: readonly string[];
  /**
   * zoneId → price in UZS. A missing key means this master has no price for
   * that zone → "по запросу". Every zone is priced today; the fallback exists
   * so a zone added before its price cannot be quoted at a guess. Each master
   * carries her own price list; there is no studio-wide rate.
   */
  prices: Readonly<Record<string, number | undefined>>;
  /**
   * Her combo discount, or absent when she gives none (Рената). Absent is not
   * "0%" by accident — it is the studio's actual position.
   */
  discount?: MasterDiscount;
  /**
   * Her fixed-price bundles. Only Рената has any. A set is her own offer, so it
   * is never applied to a booking made with "любой мастер".
   */
  sets?: readonly ServiceSet[];
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
  /**
   * The zones `total_price` and `duration_min` were computed from, server-side
   * (requires 12_server_pricing.sql). Null on every row created before that
   * migration — those prices came from the browser and cannot be re-derived.
   * Not shown anywhere: it exists so a disputed total can be recomputed.
   */
  zone_ids?: string[] | null;
}
