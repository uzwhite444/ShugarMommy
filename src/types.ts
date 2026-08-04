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
  name: string;
  role: Localized;
  experienceYears: number;
  description: Localized;
  /** Initials shown in the avatar placeholder until a real photo is added. */
  initials: string;
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
}
