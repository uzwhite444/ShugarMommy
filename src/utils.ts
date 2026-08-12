import { LanguageCode, Localized, Master, ServiceSet, ServiceZone } from './types';
import { MASTERS, STUDIO_HOURS, ZONE_DURATION_ESTIMATE_MIN, zonePriceRange } from './data';

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

/** Russian plural pick: 1 год / 2 года / 5 лет. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Master.experienceMonths → "7 лет опыта" / "6 месяцев опыта".
 *
 * Whole years are shown as years, anything else as months — so 6 stays "6
 * месяцев" and never becomes "0.5 года". A value like 18 deliberately renders
 * as "18 месяцев" rather than "1 год 6 месяцев": no master needs the compound
 * form, and the simple rule cannot produce a wrong claim.
 */
export function formatExperience(months: number, lang: LanguageCode): string {
  const useYears = months >= 12 && months % 12 === 0;
  const value = useYears ? months / 12 : months;
  if (lang === 'UZ') return `${value} ${useYears ? 'yil' : 'oy'} tajriba`;
  if (lang === 'EN') {
    const unit = useYears ? (value === 1 ? 'yr' : 'yrs') : 'mo';
    return `${value} ${unit} experience`;
  }
  const unit = useYears
    ? pluralRu(value, 'год', 'года', 'лет')
    : pluralRu(value, 'месяц', 'месяца', 'месяцев');
  return `${value} ${unit} опыта`;
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
 * мастер", which returns the zone's own price — the LOWEST across the masters,
 * i.e. an «от» figure, because that booking may be served by any of them.
 * Returns null when the master does not perform the zone, or nobody prices it.
 */
export function zonePriceFor(zone: ServiceZone, master?: Master | null): number | null {
  if (!master) return zone.price;
  if (!master.zoneIds.includes(zone.id)) return null;
  return master.prices[zone.id] ?? null;
}

/**
 * The set this exact selection is, with this master — or null.
 *
 * Match is on the WHOLE selection, not a subset: adding one more zone to a set's
 * composition means the client is no longer buying that set and must pay per
 * zone. A null master never matches — a set is one master's own offer, and her
 * set price can be higher than another master's plain sum (Set 1 is 180 000
 * with Рената, but the same two zones are 160 000 with Ангелина).
 */
export function findMatchingSet(
  zoneIds: readonly string[],
  master?: Master | null,
): ServiceSet | null {
  if (!master?.sets) return null;
  const selected = new Set(zoneIds);
  return (
    master.sets.find(
      (set) => set.zoneIds.length === selected.size && set.zoneIds.every((id) => selected.has(id)),
    ) ?? null
  );
}

/** What a set's zones would cost one by one with this master — the "было" price. */
export function setListPrice(set: ServiceSet, master: Master): number {
  return set.zoneIds.reduce((sum, id) => sum + (master.prices[id] ?? 0), 0);
}

/**
 * How long the chair is occupied, from the studio's own ESTIMATES — see
 * ZONE_DURATION_ESTIMATE_MIN in data.ts. Only ever used to reserve slots, never
 * shown as a per-zone promise.
 */
export function estimateVisitMinutes(zones: readonly ServiceZone[]): number {
  return zones.reduce((sum, zone) => sum + (ZONE_DURATION_ESTIMATE_MIN[zone.id] ?? 0), 0);
}

/**
 * The cheapest master who performs EVERY priced zone in the basket, or null
 * when no single master covers it. Used only to quote a reachable floor while
 * the client has not picked anyone — never to pick a master on her behalf, so
 * her discount and her sets stay out of it.
 */
function cheapestMasterFor(zones: readonly ServiceZone[]): Master | null {
  const wanted = zones.filter((zone) => zone.price !== null).map((zone) => zone.id);
  if (wanted.length === 0) return null;

  let best: Master | null = null;
  let bestSum = Infinity;
  for (const candidate of MASTERS) {
    if (!wanted.every((id) => candidate.zoneIds.includes(id))) continue;
    let sum = 0;
    let complete = true;
    for (const id of wanted) {
      const price = candidate.prices[id];
      if (price === undefined) {
        complete = false;
        break;
      }
      sum += price;
    }
    if (complete && sum < bestSum) {
      bestSum = sum;
      best = candidate;
    }
  }
  return best;
}

export interface CalcResult {
  /** Sum of the zones that actually have a price, before any set or discount. */
  subtotal: number;
  /** The chosen master's combo discount, or 0 when none applies. */
  discountPct: number;
  discountAmount: number;
  total: number;
  /** The fixed-price set this selection is, when it is one. */
  appliedSet: ServiceSet | null;
  /** `subtotal - appliedSet.price`, i.e. what the set saves. 0 without a set. */
  setSavings: number;
  /**
   * True when `total` is a FLOOR, not a quote: no master is chosen and at least
   * one selected zone costs different amounts at different masters. The UI must
   * print «от» in front of the number — otherwise picking Рената afterwards
   * silently raises the price the client was shown.
   */
  priceVaries: boolean;
  /**
   * Whose prices `subtotal` is actually built from. Equals the chosen master,
   * or — with nobody chosen — the cheapest one who covers the whole basket.
   * The receipt must price its ROWS from this too, otherwise the lines do not
   * add up to the total the client reads under them.
   */
  quotedBy: Master | null;
  /** Selected zones that carry a price — the ones `subtotal` is built from. */
  pricedZones: ServiceZone[];
  /**
   * Selected zones nobody has priced (today: Подбородок, and anything the
   * chosen master does not perform). They are excluded from every number above;
   * show them as "+ N зон по запросу" so the total is never quietly wrong.
   */
  onRequestZones: ServiceZone[];
  /** Estimated chair time for ALL selected zones, priced or not. */
  durationMin: number;
}

/**
 * Totals for the selected zones at the chosen master's prices.
 *
 * ORDER, and why it is this order:
 *
 * 1. Split the selection into priced / on-request. An on-request zone never
 *    enters any number below — it also blocks a set match, since a selection
 *    with an extra zone in it is not that set.
 * 2. A SET WINS OVER THE DISCOUNT. If the selection is exactly one of the
 *    master's sets, `total` is the set price and no percentage is applied.
 *    Today the two can never collide (only Рената has sets, and she has no
 *    discount), so this rule is here to decide the case in advance: a set is a
 *    price the studio has already discounted, and stacking a second reduction
 *    on top would quote below what the studio charges.
 * 3. Otherwise the master's own discount applies, counted on PRICED zones only —
 *    a zone whose price is not even in the subtotal cannot earn a reduction.
 *
 * "ЛЮБОЙ МАСТЕР" (`master` null/omitted) gets the lowest per-zone price and
 * NO discount and NO set. The discount and the sets belong to specific masters:
 * quoting −20% before a master is chosen would promise a reduction that
 * disappears the moment the client picks Рената. The price is safe to show
 * low because it is labelled «от» via `priceVaries`; a discount cannot be
 * labelled that way, so it is withheld instead.
 */
export function calcTotal(zones: readonly ServiceZone[], master?: Master | null): CalcResult {
  // With nobody chosen, quoting each zone at its own cheapest master can invent
  // a total no single master would ever charge: lash lamination is Рената-only
  // at 200 000, but deep bikini's floor is Ангелина's 110 000, and 310 000 is
  // reachable by neither. So the floor is the cheapest master who can do the
  // WHOLE basket. If nobody can, there is no single-visit price to quote and
  // the per-zone floor stays — the UI already marks it «от».
  const quoteMaster = master ?? cheapestMasterFor(zones);

  const pricedZones: ServiceZone[] = [];
  const onRequestZones: ServiceZone[] = [];
  let subtotal = 0;

  for (const zone of zones) {
    const price = zonePriceFor(zone, quoteMaster);
    if (price === null) {
      onRequestZones.push(zone);
    } else {
      pricedZones.push(zone);
      subtotal += price;
    }
  }

  const appliedSet = findMatchingSet(
    zones.map((z) => z.id),
    master,
  );

  const discountPct =
    !appliedSet && master?.discount && pricedZones.length >= master.discount.minZones
      ? master.discount.pct
      : 0;
  const discountAmount = Math.round((subtotal * discountPct) / 100);

  return {
    subtotal,
    discountPct,
    discountAmount,
    total: appliedSet ? appliedSet.price : subtotal - discountAmount,
    appliedSet,
    setSavings: appliedSet ? subtotal - appliedSet.price : 0,
    priceVaries: !master && pricedZones.some((zone) => zonePriceRange(zone.id).varies),
    quotedBy: quoteMaster,
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
