import {
  FaqItem,
  Master,
  MasterScheduleRule,
  Review,
  ServiceZone,
  WorkWindow,
} from './types';

/**
 * Local YYYY-MM-DD, never a UTC shift — Asia/Tashkent is UTC+5, so
 * toISOString() would move any evening date back a day.
 *
 * Lives here rather than in utils.ts on purpose: the schedule rules below are
 * matched on this exact string, and utils.ts imports from this module, so the
 * helper has to sit on the dependency-free side to keep the graph acyclic.
 */
export function toIsoDate(date: Date | string): string {
  if (typeof date === 'string') return date.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ---------------------------------------------------------------------------
 * Prices
 * -------------------------------------------------------------------------*/

/**
 * The price list Ангелина and Муслима both work at, in UZS (zoneId → price).
 * Single source of truth: SERVICE_ZONES reads its public price from here and
 * both masters reference it, so a price is edited in exactly one place.
 *
 * A zone missing from this map has no price yet ("по запросу") — that is the
 * case for Ягодицы and Поясница, and for every face zone.
 */
export const STANDARD_PRICES: Readonly<Record<string, number | undefined>> = {
  'arms-full': 120_000,
  'arms-half': 80_000,
  hands: 30_000,
  underarms: 50_000,
  'legs-full': 170_000,
  'legs-half': 130_000,
  thighs: 90_000,
  'bikini-deep': 110_000,
  back: 60_000,
  chest: 60_000,
  belly: 60_000,
  // buttocks / lower-back: цену владелица пришлёт отдельно.
};

/* ---------------------------------------------------------------------------
 * Zones
 * -------------------------------------------------------------------------*/

type ZoneDef = Omit<ServiceZone, 'price'>;

/**
 * Official zone names, worded exactly as the studio owner gave them —
 * including the "+ кисти, пальчики" qualifiers. Ids are stable: they travel in
 * "?zones=" share links and anchor the dots in BodyMap, so renaming one
 * silently breaks old links.
 */
const ZONE_DEFS: readonly ZoneDef[] = [
  // Руки
  {
    id: 'arms-full',
    category: 'arms',
    name: {
      RU: 'Руки полностью + кисти, пальчики',
      UZ: 'Qo‘llar to‘liq + kaft, barmoqlar',
      EN: 'Full arms + hands, fingers',
    },
  },
  {
    id: 'arms-half',
    category: 'arms',
    name: {
      RU: 'Руки до локтя + кисти, пальчики',
      UZ: 'Qo‘llar tirsakkacha + kaft, barmoqlar',
      EN: 'Arms to the elbow + hands, fingers',
    },
  },
  {
    id: 'hands',
    category: 'arms',
    name: { RU: 'Кисти + пальчики', UZ: 'Kaft + barmoqlar', EN: 'Hands + fingers' },
  },
  {
    id: 'underarms',
    category: 'arms',
    name: { RU: 'Подмышечные впадины', UZ: 'Qo‘ltiq osti', EN: 'Underarms' },
  },
  // Ноги
  {
    id: 'legs-full',
    category: 'legs',
    name: {
      RU: 'Ноги полностью + пальчики',
      UZ: 'Oyoqlar to‘liq + barmoqlar',
      EN: 'Full legs + toes',
    },
  },
  {
    id: 'legs-half',
    category: 'legs',
    name: {
      RU: 'Голени с захватом колена + пальчики',
      UZ: 'Boldirlar tizza bilan + barmoqlar',
      EN: 'Shins incl. the knee + toes',
    },
  },
  {
    id: 'thighs',
    category: 'legs',
    name: {
      RU: 'Бёдра с захватом колена',
      UZ: 'Sonlar tizza bilan',
      EN: 'Thighs incl. the knee',
    },
  },
  // Бикини
  {
    id: 'bikini-deep',
    category: 'bikini',
    name: { RU: 'Глубокое бикини', UZ: 'Chuqur bikini', EN: 'Deep bikini' },
  },
  // Тело
  // 'Bel' means waist in Uzbek — the zone sold here is the back, i.e. 'Orqa'.
  { id: 'back', category: 'body', name: { RU: 'Спина', UZ: 'Orqa', EN: 'Back' } },
  { id: 'chest', category: 'body', name: { RU: 'Грудь', UZ: 'Ko‘krak', EN: 'Chest' } },
  // Ягодицы и Поясница: без цены, но остаются на сайте — владелица пришлёт цены.
  { id: 'buttocks', category: 'body', name: { RU: 'Ягодицы', UZ: 'Dumba', EN: 'Buttocks' } },
  { id: 'lower-back', category: 'body', name: { RU: 'Поясница', UZ: 'Bel', EN: 'Lower back' } },
  { id: 'belly', category: 'body', name: { RU: 'Живот', UZ: 'Qorin', EN: 'Belly' } },

  // Лицо — делает ТОЛЬКО Рената. Скрыто целиком, пока нет её прайса; когда
  // прайс придёт, убрать `hidden` здесь и у мастера ниже.
  {
    id: 'face-full',
    category: 'face',
    hidden: true,
    name: { RU: 'Лицо полностью', UZ: 'Yuz to‘liq', EN: 'Full face' },
  },
  {
    id: 'mustache',
    category: 'face',
    hidden: true,
    name: { RU: 'Усики', UZ: 'Mo‘ylov', EN: 'Upper lip' },
  },
  {
    id: 'forehead',
    category: 'face',
    hidden: true,
    name: { RU: 'Лобная часть', UZ: 'Peshona', EN: 'Forehead' },
  },
  {
    id: 'sideburns',
    category: 'face',
    hidden: true,
    name: { RU: 'Бакенбарды', UZ: 'Bakenbardlar', EN: 'Sideburns' },
  },
  {
    id: 'chin',
    category: 'face',
    hidden: true,
    name: { RU: 'Подбородок', UZ: 'Iyak', EN: 'Chin' },
  },
  {
    id: 'neck-nape',
    category: 'face',
    hidden: true,
    name: { RU: 'Шея (затылочная часть)', UZ: 'Bo‘yin (ensa qismi)', EN: 'Neck (nape)' },
  },
];

/** Every zone the studio knows about, including the hidden face ones. */
export const ALL_SERVICE_ZONES: readonly ServiceZone[] = ZONE_DEFS.map((zone) => ({
  ...zone,
  price: STANDARD_PRICES[zone.id] ?? null,
}));

/**
 * The public price list. Use THIS everywhere the visitor can see or pick a
 * zone — it already excludes zones the studio has not published yet.
 */
export const SERVICE_ZONES: readonly ServiceZone[] = ALL_SERVICE_ZONES.filter((z) => !z.hidden);

export function findZone(id: string): ServiceZone | undefined {
  return ALL_SERVICE_ZONES.find((z) => z.id === id);
}

/**
 * ESTIMATES, NOT STUDIO DATA. The owner has never given procedure durations —
 * these are the studio's working guesses, kept here so the booking grid can
 * reserve a realistic amount of chair time instead of a flat 30 minutes for a
 * five-zone combo (which would let the slot be double-booked).
 *
 * Because they are guesses they are DELIBERATELY not part of ServiceZone and
 * must NOT be printed next to a zone in the price list — the client would read
 * them as a promise. They are for slot maths only.
 *
 * TODO: подтвердить длительности у владелицы и заменить здесь.
 */
export const ZONE_DURATION_ESTIMATE_MIN: Readonly<Record<string, number | undefined>> = {
  'arms-full': 40,
  'arms-half': 30,
  hands: 15,
  underarms: 15,
  'legs-full': 60,
  'legs-half': 40,
  thighs: 30,
  'bikini-deep': 40,
  back: 30,
  chest: 20,
  buttocks: 20,
  'lower-back': 15,
  belly: 20,
  'face-full': 30,
  mustache: 10,
  forehead: 10,
  sideburns: 10,
  chin: 10,
  'neck-nape': 15,
};

export const CATEGORY_LABELS = {
  face: { RU: 'Лицо', UZ: 'Yuz', EN: 'Face' },
  arms: { RU: 'Руки', UZ: 'Qo‘llar', EN: 'Arms' },
  legs: { RU: 'Ноги', UZ: 'Oyoqlar', EN: 'Legs' },
  bikini: { RU: 'Бикини', UZ: 'Bikini', EN: 'Bikini' },
  body: { RU: 'Тело', UZ: 'Tana', EN: 'Body' },
} as const;

/* ---------------------------------------------------------------------------
 * Masters
 * -------------------------------------------------------------------------*/

/** Mon–Sat. Sunday is not worked by anyone — that is where the day off comes from. */
const MON_TO_SAT: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Через день: вторник, четверг, суббота. */
const TUE_THU_SAT: readonly number[] = [2, 4, 6];

/** Ренатин график меняется с этой даты. */
const RENATA_AUTUMN_FROM = '2026-09-01';

const BODY_ZONE_IDS: readonly string[] = ALL_SERVICE_ZONES.filter(
  (z) => z.category !== 'face',
).map((z) => z.id);

const ALL_ZONE_IDS: readonly string[] = ALL_SERVICE_ZONES.map((z) => z.id);

/**
 * Мастера. There is no discount mechanic any more — every master carries her
 * own price list, and "любой мастер" quotes the price the visible masters share.
 */
export const ALL_MASTERS: readonly Master[] = [
  {
    id: 'renata',
    name: { RU: 'Рената', UZ: 'Renata', EN: 'Renata' },
    // HIDDEN until her price list arrives. To publish her: delete this line,
    // fill her entry in STANDARD_PRICES terms below (prices: {...}) and drop
    // `hidden: true` from the face zones in ZONE_DEFS — she is the only master
    // who does them.
    hidden: true,
    title: { RU: 'Топ-мастер', UZ: 'Top-usta', EN: 'Top master' },
    experienceYears: 7,
    credentials: {
      RU: 'Среднее медицинское образование',
      UZ: 'O‘rta tibbiy ma’lumot',
      EN: 'Medical college degree',
    },
    // Единственная, кто делает зоны лица.
    zoneIds: ALL_ZONE_IDS,
    // Прайс не предоставлен — все её зоны идут «по запросу».
    prices: {},
    schedule: [
      // Август: часы известны, дни недели владелицей не уточнялись — берём
      // общий студийный режим (пн–сб).
      { effectiveFrom: null, weekdays: MON_TO_SAT, open: '11:00', close: '19:00' },
      // С сентября — через день, часы те же.
      { effectiveFrom: RENATA_AUTUMN_FROM, weekdays: TUE_THU_SAT, open: '11:00', close: '19:00' },
    ],
  },
  {
    id: 'angelina',
    name: { RU: 'Ангелина', UZ: 'Angelina', EN: 'Angelina' },
    // Стаж владелицей не указан — поля experienceYears здесь быть не должно.
    title: {
      RU: 'Сертифицированный мастер',
      UZ: 'Sertifikatlangan usta',
      EN: 'Certified master',
    },
    zoneIds: BODY_ZONE_IDS,
    prices: STANDARD_PRICES,
    schedule: [{ effectiveFrom: null, weekdays: MON_TO_SAT, open: '09:00', close: '19:00' }],
  },
  {
    id: 'muslima',
    name: { RU: 'Муслима', UZ: 'Muslima', EN: 'Muslima' },
    title: {
      RU: 'Сертифицированный мастер',
      UZ: 'Sertifikatlangan usta',
      EN: 'Certified master',
    },
    zoneIds: BODY_ZONE_IDS,
    prices: STANDARD_PRICES,
    schedule: [{ effectiveFrom: null, weekdays: MON_TO_SAT, open: '08:00', close: '20:00' }],
  },
];

/**
 * Masters the site may show or book. Use THIS everywhere on the public site —
 * ALL_MASTERS is only for admin tooling that must still see hidden masters.
 */
export const MASTERS: readonly Master[] = ALL_MASTERS.filter((m) => !m.hidden);

/**
 * Canonical master identifier stored in bookings.master / blocked_slots.master.
 * INVARIANT: always the RU spelling, whatever language the visitor browses in —
 * lib/availability.ts keys takenByMaster on it and the admin panel's existing
 * rows already contain it. Never store a localized name.
 */
export function masterKey(master: Master): string {
  return master.name.RU;
}

export function findMaster(id: string): Master | undefined {
  return ALL_MASTERS.find((m) => m.id === id);
}

/* ---------------------------------------------------------------------------
 * Schedule
 * -------------------------------------------------------------------------*/

/**
 * The rule in force for a master on a given VISIT date — the latest rule whose
 * `effectiveFrom` has already started (null counts as "since forever").
 * Deliberately date-driven: booking a September slot in August must already
 * use the September rule.
 */
function ruleOn(master: Master, iso: string): MasterScheduleRule | null {
  let chosen: MasterScheduleRule | null = null;
  for (const rule of master.schedule) {
    if (rule.effectiveFrom !== null && rule.effectiveFrom > iso) continue;
    if (
      chosen === null ||
      chosen.effectiveFrom === null ||
      (rule.effectiveFrom !== null && rule.effectiveFrom > chosen.effectiveFrom)
    ) {
      chosen = rule;
    }
  }
  return chosen;
}

/** Opening window of one master on one date, or null when she does not work. */
export function masterHoursOn(master: Master, date: Date | string): WorkWindow | null {
  const iso = toIsoDate(date);
  const rule = ruleOn(master, iso);
  if (!rule) return null;
  const weekday = new Date(`${iso}T00:00:00`).getDay();
  if (!rule.weekdays.includes(weekday)) return null;
  return { open: rule.open, close: rule.close };
}

/** Visible masters working on the given date. */
export function mastersWorkingOn(date: Date | string): Master[] {
  return MASTERS.filter((m) => masterHoursOn(m, date) !== null);
}

/**
 * Canonical names of the masters working that date — the roster
 * lib/availability.ts needs to decide whether "любой мастер" is really booked out.
 */
export function workingMasterKeys(date: Date | string): string[] {
  return mastersWorkingOn(date).map(masterKey);
}

function widen(window: WorkWindow | null, next: WorkWindow): WorkWindow {
  if (!window) return next;
  return {
    open: next.open < window.open ? next.open : window.open,
    close: next.close > window.close ? next.close : window.close,
  };
}

/**
 * Combined opening window for "любой мастер" on that date: earliest open of any
 * working master to the latest close. Returns null when nobody works — that is
 * where "воскресенье — выходной" now comes from, derived instead of hardcoded.
 */
export function studioHoursOn(date: Date | string): WorkWindow | null {
  let window: WorkWindow | null = null;
  for (const master of mastersWorkingOn(date)) {
    const hours = masterHoursOn(master, date);
    if (hours) window = widen(window, hours);
  }
  return window;
}

/** True when no visible master works that date (today: every Sunday). */
export function isStudioClosedOn(date: Date | string): boolean {
  return studioHoursOn(date) === null;
}

/**
 * Widest window the studio is ever open, computed from the masters' rules —
 * 08:00–20:00 with the current line-up. For static copy (contacts, schema.org)
 * and the admin time grid; anything date-specific must use studioHoursOn().
 */
export const STUDIO_HOURS: WorkWindow = (() => {
  let window: WorkWindow | null = null;
  for (const master of MASTERS) {
    for (const rule of master.schedule) {
      window = widen(window, { open: rule.open, close: rule.close });
    }
  }
  // MASTERS is never empty in practice; the fallback keeps the type honest.
  return window ?? { open: '09:00', close: '19:00' };
})();

/** Weekdays (Date.getDay()) at least one visible master ever works. */
export const STUDIO_WEEKDAYS: readonly number[] = [
  ...new Set(MASTERS.flatMap((m) => m.schedule.flatMap((r) => [...r.weekdays]))),
].sort((a, b) => a - b);

/* ---------------------------------------------------------------------------
 * Marketing copy
 * -------------------------------------------------------------------------*/

export const REVIEWS: Review[] = [
  {
    id: 'r1',
    author: 'Диана',
    rating: 5,
    service: { RU: 'Глубокое бикини', UZ: 'Chuqur bikini', EN: 'Deep bikini' },
    text: {
      RU: 'Хожу уже полгода — ни одного вросшего волоска, кожа идеальная. Мастера очень деликатные.',
      UZ: 'Yarim yildan beri kelaman — teri ideal, ustalar juda ehtiyotkor.',
      EN: 'Six months in — zero ingrown hairs, perfect skin. Very delicate masters.',
    },
  },
  {
    id: 'r2',
    author: 'Азиза',
    rating: 5,
    service: { RU: 'Ноги полностью', UZ: 'Oyoqlar to‘liq', EN: 'Full legs' },
    text: {
      RU: 'Боялась, что будет больно, но всё прошло легко. Атмосфера уютная, всё стерильно.',
      UZ: 'Og‘riqdan qo‘rqdim, lekin hammasi oson o‘tdi. Muhit shinam, hammasi steril.',
      EN: 'I feared the pain, but it was easy. Cosy atmosphere, everything sterile.',
    },
  },
  {
    id: 'r3',
    author: 'Камила',
    rating: 5,
    service: { RU: 'Комплекс', UZ: 'Kompleks', EN: 'Combo' },
    text: {
      RU: 'Беру комплекс из трёх зон — со скидкой выходит очень выгодно. Запись через сайт удобная.',
      UZ: 'Uch zonali kompleks olaman — chegirma bilan juda foydali. Sayt orqali yozilish qulay.',
      EN: 'I book a 3-zone combo — great value with the discount. Online booking is handy.',
    },
  },
  {
    id: 'r4',
    author: 'Лола',
    rating: 5,
    service: { RU: 'Подмышечные впадины', UZ: 'Qo‘ltiq osti', EN: 'Underarms' },
    text: {
      RU: 'Быстро, аккуратно, без раздражения. Больше не вернусь к бритве!',
      UZ: 'Tez, ozoda, qizarishsiz. Ustaraga qaytmayman!',
      EN: 'Quick, neat, no irritation. Never going back to razors!',
    },
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: { RU: 'Это больно?', UZ: 'Bu og‘riqlimi?', EN: 'Does it hurt?' },
    answer: {
      RU: 'Ощущения индивидуальны, но шугаринг мягче воска: паста захватывает только волоски, а не кожу. С каждой процедурой волосы истончаются и дискомфорт снижается.',
      UZ: 'Sezgi har kimda har xil, lekin shugaring mumdan yumshoqroq: pasta faqat tuklarni oladi, terini emas. Har bir muolajadan keyin tuklar ingichkalashadi va og‘riq kamayadi.',
      EN: 'Sensation varies, but sugaring is gentler than wax: the paste grips hair, not skin. With each visit hair gets finer and discomfort decreases.',
    },
  },
  {
    question: { RU: 'Какая длина волос нужна?', UZ: 'Tuk qancha uzun bo‘lishi kerak?', EN: 'How long should hair be?' },
    answer: {
      RU: 'Оптимально от 8 мм до 1 см — примерно 2–3 недели после бритвы. Если длиннее, мастер всё равно всё сделает.',
      UZ: 'Eng maqbul 8 mm dan 1 sm gacha — ustaradan keyin taxminan 2–3 hafta. Uzunroq bo‘lsa ham usta hammasini qiladi.',
      EN: 'Ideally 8 mm to 1 cm — about 2–3 weeks after shaving. Longer is fine, the master will handle it.',
    },
  },
  {
    question: { RU: 'Как подготовиться к процедуре?', UZ: 'Muolajaga qanday tayyorlanish kerak?', EN: 'How do I prepare?' },
    answer: {
      RU: 'Скрабом пользоваться можно — он даже помогает против вросших волосков. За сутки не загорайте, а в день процедуры не наносите кремы и масла на зону.',
      UZ: 'Skrabdan foydalanish mumkin — u hatto ichki o‘sgan tuklarga qarshi yordam beradi. Bir kun oldin quyoshda toblanmang, muolaja kuni krem yoki moy surtmang.',
      EN: 'A scrub is fine — it even helps against ingrown hairs. Just avoid sunbathing for 24h and skip creams and oils on the day.',
    },
  },
  {
    question: { RU: 'Сколько держится эффект?', UZ: 'Natija qancha davom etadi?', EN: 'How long does it last?' },
    answer: {
      RU: 'В среднем 2–3 недели гладкой кожи. При регулярных процедурах волосы растут медленнее и реже.',
      UZ: 'O‘rtacha 2–3 hafta silliq teri. Muntazam muolajada tuklar sekinroq o‘sadi.',
      EN: 'On average 2–3 weeks of smooth skin. With regular visits hair grows back slower and thinner.',
    },
  },
  {
    question: { RU: 'Всё ли стерильно?', UZ: 'Hammasi sterilmi?', EN: 'Is everything sterile?' },
    answer: {
      RU: 'Да. Одноразовые шпатели, перчатки и простыни, паста набирается только один раз. Инструменты проходят полную дезинфекцию.',
      UZ: 'Ha. Bir martalik shpatel, qo‘lqop va choyshablar, pasta bankadan faqat bir marta olinadi. Asboblar to‘liq dezinfeksiya qilinadi.',
      EN: 'Yes. Single-use spatulas, gloves and sheets, and the paste is never double-dipped. Instruments are fully disinfected.',
    },
  },
];
