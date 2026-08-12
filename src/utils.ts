import { LanguageCode, Localized, Master, ServiceZone } from './types';
import { STUDIO_HOURS, ZONE_DURATION_ESTIMATE_MIN } from './data';

/** Telegram DM of the studio administrator — receives booking requests. */
export const MANAGER_TELEGRAM = 'ShugarMommyUz'; // TODO: заменить на реальный ник

/** Studio bot — sends visit reminders to clients who opt in. */
export const MANAGER_BOT = 'Shugarr_Mommy_bot';

/** Studio Instagram handle. */
export const INSTAGRAM = 'shugar.mommy'; // TODO: заменить на реальный ник

/** Studio phone number (display + tel: link). */
export const PHONE = '+998 90 000-00-00'; // TODO: заменить на реальный номер

/** Studio address per language. */
export const ADDRESS: Localized = {
  RU: 'г. Андижан, ул. Примерная, 1', // TODO: заменить на реальный адрес
  UZ: "Andijon sh., Namuna ko'chasi, 1",
  EN: '1 Example St., Andijan',
};

/**
 * Widest opening window across the current masters, re-exported so contact
 * copy has one obvious import. Anything date-specific (which master works when,
 * whether the studio is open at all) must use studioHoursOn()/isStudioClosedOn()
 * from data.ts instead — this is a display range, not a booking rule.
 */
export { STUDIO_HOURS };

/** Combo discounts: pick N+ priced zones → percentage off the subtotal. */
export const DISCOUNT_TIERS: ReadonlyArray<{ minZones: number; pct: number }> = [
  { minZones: 5, pct: 15 },
  { minZones: 3, pct: 10 },
];

/**
 * Avatar initial for a master, taken from the name in the CURRENT language —
 * a hardcoded Cyrillic letter sat next to "Angelina" in the Latin locales.
 */
export function masterInitial(master: Master, lang: LanguageCode): string {
  return getLocalized(master.name, lang).trim().charAt(0).toUpperCase();
}

export function getLocalized(loc: Localized, lang: LanguageCode): string {
  return loc[lang] || loc.RU;
}

/** Shown wherever the studio has not set a price yet. */
export const PRICE_ON_REQUEST: Localized = {
  RU: 'по запросу',
  UZ: 'so‘rov bo‘yicha',
  EN: 'on request',
};

/** "150 000 сум" / "150 000 so'm" / "150,000 UZS" depending on language. */
export function formatPrice(price: number, lang: LanguageCode = 'RU'): string {
  const formatted = new Intl.NumberFormat(lang === 'EN' ? 'en-US' : 'ru-RU').format(price);
  const unit = lang === 'RU' ? 'сум' : lang === 'UZ' ? "so'm" : 'UZS';
  return `${formatted} ${unit}`;
}

/** Price of a zone, or the localized «по запросу» when the studio has none. */
export function formatZonePrice(price: number | null, lang: LanguageCode = 'RU'): string {
  return price === null ? getLocalized(PRICE_ON_REQUEST, lang) : formatPrice(price, lang);
}

/**
 * What this zone costs with this master. `master` omitted / null means "любой
 * мастер": the zone's own price, which is the rate the visible masters share.
 * Returns null when nobody has published a price for it yet.
 */
export function zonePriceFor(zone: ServiceZone, master?: Master | null): number | null {
  if (!master) return zone.price;
  if (!master.zoneIds.includes(zone.id)) return null;
  return master.prices[zone.id] ?? null;
}

/**
 * How long the chair is occupied, from the studio's own ESTIMATES — see
 * ZONE_DURATION_ESTIMATE_MIN in data.ts. Only ever used to reserve slots, never
 * shown as a per-zone promise.
 */
export function estimateVisitMinutes(zones: readonly ServiceZone[]): number {
  return zones.reduce((sum, zone) => sum + (ZONE_DURATION_ESTIMATE_MIN[zone.id] ?? 0), 0);
}

export interface CalcResult {
  /** Sum of the zones that actually have a price. */
  subtotal: number;
  /** Set discount for picking several zones. */
  discountPct: number;
  discountAmount: number;
  total: number;
  /** Selected zones that carry a price — the ones `subtotal` is built from. */
  pricedZones: ServiceZone[];
  /**
   * Selected zones the studio has not priced yet (Ягодицы, Поясница, лицо).
   * They are excluded from every number above; show them as
   * "+ N зон по запросу" so the total is never quietly wrong.
   */
  onRequestZones: ServiceZone[];
  /** Estimated chair time for ALL selected zones, priced or not. */
  durationMin: number;
}

/**
 * Totals for the selected zones with the chosen master's price list ("любой
 * мастер" → the shared price list).
 *
 * There is no master discount any more: each master has her own prices.
 *
 * The combo tier is counted on PRICED zones only — a discount cannot be earned
 * by a zone whose price is not even in the subtotal, and counting it would
 * quote the client a total lower than the studio will charge.
 */
export function calcTotal(zones: readonly ServiceZone[], master?: Master | null): CalcResult {
  const pricedZones: ServiceZone[] = [];
  const onRequestZones: ServiceZone[] = [];
  let subtotal = 0;

  for (const zone of zones) {
    const price = zonePriceFor(zone, master);
    if (price === null) {
      onRequestZones.push(zone);
    } else {
      pricedZones.push(zone);
      subtotal += price;
    }
  }

  const tier = DISCOUNT_TIERS.find((t) => pricedZones.length >= t.minZones);
  const discountPct = tier ? tier.pct : 0;
  const discountAmount = Math.round((subtotal * discountPct) / 100);

  return {
    subtotal,
    discountPct,
    discountAmount,
    total: subtotal - discountAmount,
    pricedZones,
    onRequestZones,
    durationMin: estimateVisitMinutes(zones),
  };
}

/**
 * Reads and parses a JSON value from localStorage.
 * Corrupted or missing data must never crash the app.
 */
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
