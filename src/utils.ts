import { LanguageCode, Localized, ServiceZone } from './types';

/** Telegram DM of the studio administrator — receives booking requests. */
export const MANAGER_TELEGRAM = 'ShugarMommyUz'; // TODO: заменить на реальный ник

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

/** Working hours, same for every day. */
export const WORK_HOURS = { open: '09:00', close: '20:00' };

/** Combo discounts: pick N+ zones → percentage off the subtotal. */
export const DISCOUNT_TIERS: ReadonlyArray<{ minZones: number; pct: number }> = [
  { minZones: 5, pct: 15 },
  { minZones: 3, pct: 10 },
];

export function getLocalized(loc: Localized, lang: LanguageCode): string {
  return loc[lang] || loc.RU;
}

/** "150 000 сум" / "150 000 so'm" / "150,000 UZS" depending on language. */
export function formatPrice(price: number, lang: LanguageCode = 'RU'): string {
  const formatted = new Intl.NumberFormat(lang === 'EN' ? 'en-US' : 'ru-RU').format(price);
  const unit = lang === 'RU' ? 'сум' : lang === 'UZ' ? "so'm" : 'UZS';
  return `${formatted} ${unit}`;
}

export interface CalcResult {
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  total: number;
  durationMin: number;
}

/** Totals for the selected zones including the combo discount. */
export function calcTotal(zones: ServiceZone[]): CalcResult {
  const subtotal = zones.reduce((sum, z) => sum + z.price, 0);
  const tier = DISCOUNT_TIERS.find((t) => zones.length >= t.minZones);
  const discountPct = tier ? tier.pct : 0;
  const discountAmount = Math.round((subtotal * discountPct) / 100);
  return {
    subtotal,
    discountPct,
    discountAmount,
    total: subtotal - discountAmount,
    durationMin: zones.reduce((sum, z) => sum + z.durationMin, 0),
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
