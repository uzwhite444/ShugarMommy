import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion } from 'motion/react';
import { X, Send, Loader2, CheckCircle2, Copy, Check, BellRing } from 'lucide-react';
import { LanguageCode, Localized, Master, ServiceSet, ServiceZone, WorkWindow } from '../types';
import {
  calcTotal,
  formatPrice,
  getLocalized,
  MANAGER_BOT,
  MANAGER_TELEGRAM,
  PRICE_ON_REQUEST,
  masterInitial,
} from '../utils';
import { findZone, masterHoursOn, masterKey, MASTERS, STUDIO_HOURS, toIsoDate } from '../data';
import { createBooking } from '../lib/bookings';
import {
  fetchDayAvailability,
  isRangeTaken,
  timeToMinutes,
  type DayAvailability,
} from '../lib/availability';
import { getSource } from '../lib/attribution';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface BookingModalProps {
  language: LanguageCode;
  selectedZones: ServiceZone[];
  onClose: () => void;
  /** Removes a zone straight from the summary chips. */
  onRemoveZone?: (zoneId: string) => void;
  /** Opens the self-service cancellation form. */
  onCancelBooking?: () => void;
}

const TR = {
  title: { RU: 'Онлайн-запись', UZ: 'Onlayn yozilish', EN: 'Online booking' },
  yourCombo: { RU: 'Выбранные зоны', UZ: 'Tanlangan zonalar', EN: 'Selected zones' },
  noZones: {
    RU: 'Зоны не выбраны — обсудим услуги в чате с администратором.',
    UZ: 'Zonalar tanlanmagan — xizmatlarni administrator bilan kelishamiz.',
    EN: 'No zones selected — we will agree on services in the chat.',
  },
  total: { RU: 'Итого', UZ: 'Yakuniy', EN: 'Total' },
  // Two different mechanisms, deliberately two different words: Ангелина and
  // Муслима give a percentage off, Рената gives a fixed-price set. Calling the
  // percentage «сет» (as this modal used to) misstates both offers.
  comboDiscount: { RU: 'скидка за комплекс', UZ: 'kompleks chegirmasi', EN: 'combo discount' },
  setApplied: { RU: 'Сет', UZ: 'Set', EN: 'Set' },
  setSaving: { RU: 'выгода {sum}', UZ: '{sum} tejaysiz', EN: 'you save {sum}' },
  discountWith: {
    RU: '−{pct}% при записи к: {masters}',
    UZ: '{masters} bilan yozilsangiz −{pct}%',
    EN: '−{pct}% when booking with {masters}',
  },
  variesNote: {
    RU: 'Цена зависит от мастера — показана минимальная. Выберите мастера, чтобы увидеть точный итог.',
    UZ: 'Narx ustaga bog‘liq — eng past narx ko‘rsatilgan. Aniq summa uchun ustani tanlang.',
    EN: 'The price depends on the master — this is the lowest one. Pick a master to see the exact total.',
  },
  masterCantDo: {
    RU: 'не делает эти зоны',
    UZ: 'bu zonalarni qilmaydi',
    EN: 'does not do these zones',
  },
  anyMasterOff: {
    RU: 'недоступно для этих зон',
    UZ: 'bu zonalar uchun mavjud emas',
    EN: 'not available for these zones',
  },
  onlyMasterNote: {
    RU: 'Эти зоны выполняет только {masters}: {zones}. Другие мастера для этой записи недоступны.',
    UZ: 'Bu zonalarni faqat {masters} bajaradi: {zones}. Bu yozuv uchun boshqa ustalar mavjud emas.',
    EN: 'Only {masters} performs these zones: {zones}. Other masters cannot take this booking.',
  },
  errNoMaster: {
    RU: 'Такой набор зон сейчас не выполняет ни один мастер — напишите нам в Telegram.',
    UZ: 'Bunday zonalar to‘plamini hozir hech bir usta bajarmaydi — Telegramga yozing.',
    EN: 'No master performs this combination right now — please message us on Telegram.',
  },
  onRequestLead: {
    RU: 'В итог не входит, цену уточним при подтверждении:',
    UZ: 'Yakuniyga kirmaydi, narxni tasdiqlashda aniqlaymiz:',
    EN: 'Not included in the total, we will confirm the price:',
  },
  stepContacts: { RU: 'Ваши данные', UZ: "Ma'lumotlaringiz", EN: 'Your details' },
  stepMaster: { RU: 'Мастер', UZ: 'Usta', EN: 'Master' },
  stepWhen: { RU: 'Дата и время', UZ: 'Sana va vaqt', EN: 'Date & time' },
  name: { RU: 'Ваше имя', UZ: 'Ismingiz', EN: 'Your name' },
  phone: { RU: 'Телефон', UZ: 'Telefon', EN: 'Phone' },
  close: { RU: 'Закрыть', UZ: 'Yopish', EN: 'Close' },
  removeZone: { RU: 'Убрать зону', UZ: 'Zonani olib tashlash', EN: 'Remove zone' },
  anyMaster: { RU: 'Любой мастер', UZ: 'Istalgan usta', EN: 'Any master' },
  anyMasterHint: {
    RU: 'Подберёт администратор',
    UZ: 'Administrator tanlaydi',
    EN: 'Admin will assign',
  },
  today: { RU: 'Сегодня', UZ: 'Bugun', EN: 'Today' },
  tomorrow: { RU: 'Завтра', UZ: 'Ertaga', EN: 'Tomorrow' },
  dayOff: { RU: 'выходной', UZ: 'dam olish', EN: 'closed' },
  dayOffNote: {
    RU: 'Воскресенье — выходной. Мастер может выйти по двойному тарифу — напишите нам в Telegram.',
    UZ: 'Yakshanba — dam olish kuni. Usta ikki baravar tarif bilan chiqishi mumkin — Telegramga yozing.',
    EN: 'Sunday is our day off. A master can come in at double rate — message us on Telegram.',
  },
  hoursNote: {
    RU: 'Часы приёма: {from}–{to}',
    UZ: 'Qabul vaqti: {from}–{to}',
    EN: 'Working hours: {from}–{to}',
  },
  masterDayOff: {
    RU: 'В этот день мастер не принимает — выберите другую дату или мастера.',
    UZ: 'Bu kuni usta qabul qilmaydi — boshqa sana yoki ustani tanlang.',
    EN: 'This master does not work that day — pick another date or master.',
  },
  comment: { RU: 'Комментарий (необязательно)', UZ: 'Izoh (ixtiyoriy)', EN: 'Comment (optional)' },
  submit: { RU: 'Отправить заявку в Telegram', UZ: 'Arizani Telegramga yuborish', EN: 'Send request via Telegram' },
  disclaimer: {
    RU: 'Откроется чат с администратором в Telegram — подтвердим свободное время и запишем вас.',
    UZ: 'Telegramda administrator bilan chat ochiladi — bo‘sh vaqtni tasdiqlab, sizni yozamiz.',
    EN: 'A Telegram chat with our administrator opens — we confirm the slot and book you in.',
  },
  consentPre: {
    RU: 'Отправляя заявку, вы соглашаетесь с',
    UZ: 'Ariza yuborish orqali siz rozilik bildirasiz:',
    EN: 'By sending the request you agree to our',
  },
  consentLink: {
    RU: 'политикой конфиденциальности',
    UZ: 'maxfiylik siyosati',
    EN: 'privacy policy',
  },
  errFill: { RU: 'Укажите имя и телефон.', UZ: 'Ism va telefonni kiriting.', EN: 'Please enter your name and phone.' },
  errDate: { RU: 'Выберите дату и время.', UZ: 'Sana va vaqtni tanlang.', EN: 'Please pick a date and time.' },
  errPast: {
    RU: 'Это время уже прошло — выберите другое.',
    UZ: "Bu vaqt o'tib ketdi — boshqasini tanlang.",
    EN: 'That time has already passed — please pick another.',
  },
  errTaken: {
    RU: 'Это время уже занято — выберите другое.',
    UZ: 'Bu vaqt band — boshqasini tanlang.',
    EN: 'That time is taken — please pick another.',
  },
  errTooMany: {
    RU: 'На этот номер уже есть несколько активных записей. Напишите администратору в Telegram — поможем со временем.',
    UZ: 'Bu raqamda allaqachon bir nechta faol yozuv bor. Administratorga Telegramda yozing — vaqtni birga tanlaymiz.',
    EN: 'This number already has several active bookings. Message our administrator on Telegram and we will sort out the time.',
  },
  comboDuration: {
    RU: 'Процедура займёт около {min} мин — показываем только то время, куда она целиком помещается до закрытия.',
    UZ: 'Muolaja taxminan {min} daqiqa davom etadi — faqat yopilishgacha to‘liq sig‘adigan vaqtlar ko‘rsatiladi.',
    EN: 'The visit takes about {min} min — only start times that fit before closing are shown.',
  },
  loadingSlots: { RU: 'Проверяем свободное время…', UZ: "Bo'sh vaqtni tekshiryapmiz…", EN: 'Checking availability…' },
  dayClosed: {
    RU: 'В этот день студия не принимает — выберите другую дату.',
    UZ: 'Bu kuni studiya ishlamaydi — boshqa sanani tanlang.',
    EN: 'The studio is closed that day — please pick another date.',
  },
  noSlotsLeft: {
    RU: 'На эту дату всё занято — выберите другой день.',
    UZ: "Bu sanaga hammasi band — boshqa kunni tanlang.",
    EN: 'Fully booked that day — please pick another one.',
  },
  slotTaken: { RU: 'занято', UZ: 'band', EN: 'taken' },
  doneTitle: { RU: 'Заявка готова!', UZ: 'Ariza tayyor!', EN: 'Request ready!' },
  doneText: {
    RU: 'Если Telegram не открылся автоматически — нажмите кнопку ниже или скопируйте текст заявки.',
    UZ: 'Telegram avtomatik ochilmasa — quyidagi tugmani bosing yoki ariza matnini nusxalang.',
    EN: 'If Telegram did not open automatically, use the button below or copy the request text.',
  },
  openTg: { RU: 'Открыть Telegram', UZ: 'Telegramni ochish', EN: 'Open Telegram' },
  copyMsg: { RU: 'Скопировать заявку', UZ: 'Arizani nusxalash', EN: 'Copy request' },
  copied: { RU: 'Скопировано!', UZ: 'Nusxalandi!', EN: 'Copied!' },
  changedMind: {
    RU: 'Планы изменились? Запись можно отменить на сайте или по телефону.',
    UZ: 'Rejalar o‘zgardimi? Yozuvni saytda yoki telefon orqali bekor qilish mumkin.',
    EN: 'Plans changed? You can cancel on the site or by phone.',
  },
  cancelLink: { RU: 'Отменить запись', UZ: 'Yozuvni bekor qilish', EN: 'Cancel booking' },
  remindTitle: {
    RU: 'Напомнить за час до визита?',
    UZ: 'Tashrifdan bir soat oldin eslataylikmi?',
    EN: 'Want a reminder an hour before?',
  },
  remindText: {
    RU: 'Нажмите — откроется наш бот, останется нажать «Старт». Пришлём напоминание ровно за час.',
    UZ: 'Bosing — botimiz ochiladi, «Start» tugmasini bosing. Roppa-rosa bir soat oldin eslatamiz.',
    EN: 'Tap to open our bot and press “Start”. We will remind you exactly an hour before.',
  },
  remindBtn: { RU: 'Напомнить в Telegram', UZ: 'Telegramda eslatish', EN: 'Remind me on Telegram' },
};

/** Shortest bookable visit — one grid cell, even with no zones picked. */
const MIN_DURATION_MIN = 30;

/**
 * 30-minute slots from opening until 30 minutes before closing. The window is
 * now per-master and per-date, so this can no longer be computed once: Ангелина
 * opens at 09:00 while Муслима is already there from 08:00.
 */
function buildTimeSlots(hours: WorkWindow | null): string[] {
  if (!hours) return [];
  const open = timeToMinutes(hours.open);
  const close = timeToMinutes(hours.close);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return [];
  const slots: string[] = [];
  for (let t = Math.ceil(open / 30) * 30; t <= close - 30; t += 30) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

function widen(current: WorkWindow | null, next: WorkWindow): WorkWindow {
  if (!current) return next;
  return {
    open: next.open < current.open ? next.open : current.open,
    close: next.close > current.close ? next.close : current.close,
  };
}

/**
 * Widest window these masters ever work — the preview shown before a date is
 * picked, when no single day's rule applies yet.
 *
 * Takes a list rather than one master because "любой мастер" is now scoped to
 * the masters who can actually do the selected zones: STUDIO_HOURS would
 * promise Муслима's 08:00 for a face zone only Рената performs from 11:00.
 */
function widestHours(masters: readonly Master[]): WorkWindow {
  // Not named `window`: shadowing the DOM global here confuses narrowing.
  let widest: WorkWindow | null = null;
  for (const master of masters) {
    for (const rule of master.schedule) {
      widest = widen(widest, { open: rule.open, close: rule.close });
    }
  }
  // Every master has at least one rule; the fallback keeps the type honest.
  return widest ?? STUDIO_HOURS;
}

/** Combined window of these masters on one date, or null when none of them works. */
function unionHoursOn(masters: readonly Master[], date: string): WorkWindow | null {
  let combined: WorkWindow | null = null;
  for (const master of masters) {
    const hours = masterHoursOn(master, date);
    if (hours) combined = widen(combined, hours);
  }
  return combined;
}

/**
 * A set's title, composed from its zone names — ServiceSet carries no name of
 * its own, so the card can never drift from the price list (and is translated
 * for free).
 */
function setTitle(set: ServiceSet, lang: LanguageCode): string {
  return set.zoneIds
    .map((id) => {
      const zone = findZone(id);
      return zone ? getLocalized(zone.name, lang) : id;
    })
    .join(' + ');
}

/**
 * «от 140 000 сум» — a floor, not a quote. Uzbek marks it with the ablative
 * suffix, so this cannot be a shared prefix in all three languages.
 */
function priceFrom(price: number, lang: LanguageCode): string {
  const value = formatPrice(price, lang);
  if (lang === 'UZ') return `${value}dan`;
  if (lang === 'EN') return `from ${value}`;
  return `от ${value}`;
}

/** Next `count` days starting today, as local dates. */
function buildDays(count = 14): Date[] {
  const today = new Date();
  return Array.from(
    { length: count },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
  );
}

const INTL_LOCALE: Record<LanguageCode, string> = { RU: 'ru-RU', UZ: 'uz-Latn-UZ', EN: 'en-US' };

/** Small caps step header: "01 · Ваши данные". */
function StepLabel({ number, children }: { number: string; children: string }) {
  return (
    <p className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
      <span className="font-serif text-sm normal-case italic text-primary-dark">{number}</span>
      {children}
    </p>
  );
}

export default function BookingModal({
  language,
  selectedZones,
  onClose,
  onRemoveZone,
  onCancelBooking,
}: BookingModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);
  const reduced = useReducedMotion();

  const doneHeadingRef = useRef<HTMLHeadingElement>(null);
  // Blocks a second tap from firing a parallel insert before React re-renders
  // the button as disabled.
  const submitLockRef = useRef(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The backdrop closes the dialog only when the press *started* on it —
  // otherwise releasing a text selection over the backdrop wipes the form.
  const overlayPressRef = useRef(false);

  // Lock the page behind the modal — without this the background scrolls
  // under the dialog on touch devices and the user loses their place.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [masterId, setMasterId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  // Kept after submit so the confirmation can offer a manual Telegram link +
  // copy button — the redirect is often blocked in in-app browsers (Instagram).
  const [requestMsg, setRequestMsg] = useState('');
  const [copied, setCopied] = useState(false);
  // Set after a successful save — powers the "remind me" deep link.
  const [bookingId, setBookingId] = useState<string | null>(null);
  // Snapshot of what was actually sent. The confirmation screen must repeat the
  // request, not re-derive it: the form's state keeps living behind the success
  // screen and a later reset would rewrite what the client believes she booked.
  const [placedInfo, setPlacedInfo] = useState<{
    master: string;
    when: string;
    total: string | null;
    set: string | null;
  } | null>(null);

  const t = (loc: Localized) => getLocalized(loc, language);

  // Face, brows and polymer zones are Рената's alone. A master who does not
  // perform every selected zone must not be bookable for this visit at all —
  // otherwise the studio receives a request nobody on that shift can carry out.
  // `selectedZones` is a fresh array on every parent render, so memoising on it
  // never hits. The ids are the real dependency — deriving them inside the memo
  // keeps that true AND honest to the dependency checker, which cannot see that
  // `zoneKey` already encodes the array.
  const zoneKey = selectedZones.map((z) => z.id).join('|');
  const eligibleMasters = useMemo(() => {
    const ids = zoneKey ? zoneKey.split('|') : [];
    return MASTERS.filter((master) => ids.every((id) => master.zoneIds.includes(id)));
  }, [zoneKey]);
  // Zones that make the choice narrower, named in the explanation below.
  const restrictedZones = selectedZones.filter(
    (zone) => !MASTERS.every((master) => master.zoneIds.includes(zone.id)),
  );
  // When one master is the only one who can do the work, she is not a choice —
  // she is the booking. "Любой мастер" would otherwise quote the lowest price
  // across the studio, which is a price only a master who cannot do these zones
  // charges, and would send the admin a visit to assign to nobody.
  const soleMaster = eligibleMasters.length === 1 ? eligibleMasters[0] : null;
  // MASTERS is already filtered — a hidden master can never be selected here,
  // and an unknown or now-ineligible id simply falls back to "любой мастер".
  const selectedMaster = soleMaster ?? eligibleMasters.find((m) => m.id === masterId);
  // What the picker shows as chosen: the forced master wins over stale state.
  const activeMasterId = selectedMaster?.id ?? '';
  const calc = calcTotal(selectedZones, selectedMaster);
  // The number as it may be shown: without a master it is the lowest price of
  // the masters who could take the visit, so it has to read «от».
  const totalLabel = calc.priceVaries
    ? priceFrom(calc.total, language)
    : formatPrice(calc.total, language);
  /**
   * Masters this selection would already earn a percentage discount with —
   * shown only while no master is chosen, and always by name, because the
   * discount belongs to her and not to the studio. Mixed percentages are not
   * summarised: one line cannot state two different offers truthfully.
   */
  const discountOffers = selectedMaster
    ? []
    : eligibleMasters.flatMap((master) =>
        master.discount && calc.pricedZones.length >= master.discount.minZones
          ? [{ name: getLocalized(master.name, language), pct: master.discount.pct }]
          : [],
      );
  const discountHint =
    discountOffers.length > 0 && new Set(discountOffers.map((o) => o.pct)).size === 1
      ? { pct: discountOffers[0].pct, masters: discountOffers.map((o) => o.name).join(', ') }
      : null;
  const tgLink = `https://t.me/${MANAGER_TELEGRAM}?text=${encodeURIComponent(requestMsg)}`;

  const days = useMemo(() => buildDays(), []);
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[language], { weekday: 'short' }),
    [language],
  );

  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  // Canonical (RU) spelling — what the database stores, in every language.
  const selectedMasterName = selectedMaster ? masterKey(selectedMaster) : null;
  // How long the chair is actually occupied: "legs full + deep bikini" is 90
  // minutes, so it blocks three cells, not one.
  const comboDuration = Math.max(calc.durationMin, MIN_DURATION_MIN);

  // Load real availability whenever the customer picks a date. A stale flag
  // guards against out-of-order responses when dates are switched quickly.
  useEffect(() => {
    if (!date) {
      setAvailability(null);
      return;
    }
    let stale = false;
    // Drop the previous day's slots first — otherwise the grid keeps showing
    // them (and lets them be picked) until the new fetch resolves.
    setAvailability(null);
    setTime('');
    setLoadingSlots(true);
    fetchDayAvailability(date).then((data) => {
      if (stale) return;
      setAvailability(data);
      setLoadingSlots(false);
    });
    return () => {
      stale = true;
    };
  }, [date]);

  // Opening window that actually applies: one master's own hours once she is
  // chosen, the union of everyone on shift for "любой мастер". Before a date is
  // picked there is no rule to apply yet, so the widest window previews the grid.
  const workHours = useMemo<WorkWindow | null>(() => {
    const masters = selectedMaster ? [selectedMaster] : eligibleMasters;
    if (!date) return widestHours(masters);
    return unionHoursOn(masters, date);
  }, [date, selectedMaster, eligibleMasters]);

  // Masters on shift that date — without it "любой мастер" is blacked out as
  // soon as a single master is busy. Only the eligible ones count: a slot that
  // is free solely because Муслима is idle is not free for a face zone.
  const roster = useMemo(
    () => (date ? eligibleMasters.filter((m) => masterHoursOn(m, date)).map(masterKey) : []),
    [date, eligibleMasters],
  );

  const slots = useMemo(() => buildTimeSlots(workHours), [workHours]);
  const takenSet = useMemo(() => {
    if (!availability) return new Set<string>();
    return new Set(
      slots.filter((slot) =>
        isRangeTaken(availability, slot, selectedMasterName, comboDuration, roster),
      ),
    );
  }, [availability, slots, selectedMasterName, comboDuration, roster]);

  // A long combo cannot start so late that it would run past closing.
  const tooLateSet = useMemo(() => {
    if (!workHours) return new Set<string>();
    const close = timeToMinutes(workHours.close);
    return new Set(slots.filter((slot) => timeToMinutes(slot) + comboDuration > close));
  }, [slots, comboDuration, workHours]);

  // When "today" is picked, times that already passed cannot be booked.
  const pastSet = useMemo(() => {
    if (!date || date !== toIsoDate(new Date())) return new Set<string>();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return new Set(
      slots.filter((slot) => {
        const [h, m] = slot.split(':').map(Number);
        return h * 60 + m <= nowMin;
      }),
    );
  }, [date, slots]);

  // Switching to a master who is busy at the chosen time — or whose day simply
  // starts later, so the slot is no longer in her grid at all — clears the
  // choice, so an unbookable time can never be submitted.
  useEffect(() => {
    if (!time) return;
    if (!slots.includes(time) || takenSet.has(time) || pastSet.has(time) || tooLateSet.has(time)) {
      setTime('');
    }
  }, [slots, takenSet, pastSet, tooLateSet, time]);

  // Each master keeps her own calendar, so a date that was open for "любой
  // мастер" can be a day off for the one just picked. Drop it rather than send
  // a request for a day nobody works.
  useEffect(() => {
    if (!date) return;
    const masters = selectedMaster ? [selectedMaster] : eligibleMasters;
    if (unionHoursOn(masters, date) === null) setDate('');
  }, [selectedMaster, eligibleMasters, date]);

  // The form unmounts on success, so the focused control disappears and focus
  // would fall outside the dialog — move it onto the confirmation heading.
  useEffect(() => {
    if (placed) doneHeadingRef.current?.focus();
  }, [placed]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const allTaken =
    Boolean(date) &&
    !loadingSlots &&
    slots.length > 0 &&
    slots.every((slot) => takenSet.has(slot) || pastSet.has(slot) || tooLateSet.has(slot));

  // The chosen master does not work that date at all (the auto-reset above
  // normally gets there first — this is the belt-and-braces message).
  const noHours = Boolean(date) && !loadingSlots && slots.length === 0;

  /** Enter in a text field submits — the behaviour a <form> would give. */
  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    void handleSubmit();
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    // Last line of defence for the same rule the picker enforces: a request the
    // studio cannot carry out must not be sent, whatever state got us here.
    // (An empty selection leaves every master eligible, so this cannot fire on it.)
    if (eligibleMasters.length === 0) {
      setError(t(TR.errNoMaster));
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError(t(TR.errFill));
      return;
    }
    if (!date || !time) {
      setError(t(TR.errDate));
      return;
    }
    // The form may sit open long enough for the chosen time to pass.
    if (date === toIsoDate(new Date())) {
      const [h, m] = time.split(':').map(Number);
      const now = new Date();
      if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) {
        setTime('');
        setError(t(TR.errPast));
        return;
      }
    }
    // Everything below awaits the network, so take the lock and disable the
    // button *before* the first await — a double-tap would otherwise insert twice.
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      // Someone may have taken the slot while the form was open.
      const fresh = await fetchDayAvailability(date);
      if (isRangeTaken(fresh, time, selectedMasterName, comboDuration, roster)) {
        setAvailability(fresh);
        setTime('');
        setError(t(TR.errTaken));
        return;
      }
      setError('');

      const master = selectedMaster;
      const masterName = master ? getLocalized(master.name, language) : t(TR.anyMaster);
      const servicesText =
        selectedZones.length > 0
          ? selectedZones.map((z) => getLocalized(z.name, language)).join(', ')
          : t(TR.noZones);

      const greeting =
        language === 'RU'
          ? '✨ Здравствуйте, Shugar Mommy!\nХочу записаться на шугаринг:'
          : language === 'UZ'
            ? '✨ Assalomu alaykum, Shugar Mommy!\nShugaringga yozilmoqchiman:'
            : '✨ Hello, Shugar Mommy!\nI would like to book a sugaring session:';

      const labels =
        language === 'RU'
          ? { services: 'Зоны', master: 'Мастер', date: 'Дата', time: 'Время', total: 'Итого', onRequest: 'Цена по запросу', name: 'Имя', phone: 'Телефон', comment: 'Комментарий' }
          : language === 'UZ'
            ? { services: 'Zonalar', master: 'Usta', date: 'Sana', time: 'Vaqt', total: 'Jami', onRequest: 'Narx so‘rov bo‘yicha', name: 'Ism', phone: 'Telefon', comment: 'Izoh' }
            : { services: 'Zones', master: 'Master', date: 'Date', time: 'Time', total: 'Total', onRequest: 'Price on request', name: 'Name', phone: 'Phone', comment: 'Comment' };

      const setText = calc.appliedSet ? setTitle(calc.appliedSet, language) : null;

      let message = `${greeting}\n\n`;
      message += `💆‍♀️ ${labels.services}: ${servicesText}\n`;
      message += `👩‍🔬 ${labels.master}: ${masterName}\n`;
      message += `📅 ${labels.date}: ${date}\n`;
      message += `🕐 ${labels.time}: ${time}\n`;
      // The total covers priced zones only — quoting it while an unpriced zone
      // is in the list would understate what the studio actually charges, so
      // those zones are named separately instead of being folded in silently.
      // `totalLabel` already carries «от» when no master is picked and her
      // choice would move the price.
      if (calc.pricedZones.length > 0) {
        const discountNote =
          calc.discountPct > 0 ? ` (${t(TR.comboDiscount)} −${calc.discountPct}%)` : '';
        message += `💰 ${labels.total}: ${totalLabel}${discountNote}\n`;
      }
      // Named, not just priced: the administrator has to see which offer the
      // total came from, or the fixed set price looks like an arithmetic error.
      if (setText) {
        const saving =
          calc.setSavings > 0
            ? ` · ${t(TR.setSaving).replace('{sum}', formatPrice(calc.setSavings, language))}`
            : '';
        message += `🎁 ${t(TR.setApplied)}: ${setText}${saving}\n`;
      }
      if (calc.onRequestZones.length > 0) {
        const onRequestText = calc.onRequestZones
          .map((z) => getLocalized(z.name, language))
          .join(', ');
        message += `❓ ${labels.onRequest}: ${onRequestText}\n`;
      }
      message += `\n👤 ${labels.name}: ${name.trim()}\n📞 ${labels.phone}: ${phone.trim()}`;
      if (comment.trim()) message += `\n💬 ${labels.comment}: ${comment.trim()}`;

      // Persist to the backend. `master` must stay the canonical RU spelling —
      // availability matching and the admin panel key on it.
      const result = await createBooking({
        customer_name: name.trim(),
        phone: phone.trim(),
        services: servicesText,
        master: master ? masterKey(master) : null,
        visit_date: date,
        visit_time: time,
        total_price: calc.total,
        comment: comment.trim() || null,
        source: getSource(),
        duration_min: comboDuration,
      });

      // The database rejected the booking — showing the success screen would
      // send the client away believing she is booked.
      if (result.status === 'slot-taken') {
        setAvailability(await fetchDayAvailability(date));
        setTime('');
        setError(t(TR.errTaken));
        return;
      }
      if (result.status === 'rate-limited') {
        setError(t(TR.errTooMany));
        return;
      }
      // 'unavailable' still goes through: a backend outage must never cost the
      // studio a client, the request reaches the administrator via Telegram.

      setBookingId(result.status === 'ok' ? result.id : null);
      setRequestMsg(message);
      setPlacedInfo({
        master: masterName,
        when: `${date} · ${time}`,
        total: calc.pricedZones.length > 0 ? totalLabel : null,
        set: setText,
      });
      setPlaced(true);

      // window.open('_blank') is often blocked inside in-app browsers, so we
      // also keep the manual link + copy fallback on the confirmation screen.
      const link = `https://t.me/${MANAGER_TELEGRAM}?text=${encodeURIComponent(message)}`;
      window.open(link, '_blank', 'noopener');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestMsg);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the manual Telegram link still works.
    }
  };

  const inputCls =
    'field w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-primary';

  const pillCls = (selected: boolean) =>
    `btn-press ink-rule rule-chip rule-short min-h-11 rounded-lg border px-1 text-sm font-medium ${
      selected
        ? 'border-ink bg-ink text-canvas'
        : 'border-hairline bg-canvas text-body hover:border-muted'
    }`;

  return createPortal(
    /* The backdrop is a dimming layer, not a control: it takes no focus, so a
       keyboard handler on it could never fire. Keyboard dismissal is Escape
       (useFocusTrap) plus the labelled Close button inside the dialog. */
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onPointerDown={(e) => {
        overlayPressRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (overlayPressRef.current && e.target === e.currentTarget) onClose();
        overlayPressRef.current = false;
      }}
    >
      {/* iOS Safari resolves vh against the LARGE viewport while the fixed
          overlay matches the small one, pushing the sheet off-screen. The
          inline dvh wins where supported and is ignored where it is not,
          leaving max-h-[92vh] as the fallback. */}
      <m.div
        ref={panelRef}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 32 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={t(TR.title)}
        style={{ maxHeight: '92dvh' }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-canvas p-6 shadow-2xl sm:rounded-2xl sm:p-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display text-3xl text-ink">{t(TR.title)}</h2>
          <button
            onClick={onClose}
            aria-label={t(TR.close)}
            className="press-inner -mr-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink"
          >
            <X size={22} />
          </button>
        </div>

        {placed ? (
          <div className="text-center">
            {/* Scoped to the confirmation copy — a live region around the whole
                screen would read out every button below it too. */}
            <div role="status">
              <CheckCircle2 size={56} className="mx-auto text-success" />
              <h3 ref={doneHeadingRef} tabIndex={-1} className="display mt-4 text-2xl text-ink outline-none">
                {t(TR.doneTitle)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(TR.doneText)}</p>
            </div>

            {/* Repeat of the request as sent — same master, same total, same
                offer, so the confirmation cannot say something the Telegram
                message does not. */}
            {placedInfo && (
              <dl className="mt-5 space-y-2 rounded-xl bg-surface p-5 text-left text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">{t(TR.stepMaster)}</dt>
                  <dd className="text-right font-medium text-ink">{placedInfo.master}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">{t(TR.stepWhen)}</dt>
                  <dd className="text-right font-medium text-ink">{placedInfo.when}</dd>
                </div>
                {placedInfo.set && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">{t(TR.setApplied)}</dt>
                    <dd className="text-right font-medium text-primary-dark">{placedInfo.set}</dd>
                  </div>
                )}
                {placedInfo.total && (
                  <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-2">
                    <dt className="text-muted">{t(TR.total)}</dt>
                    <dd className="text-right font-semibold text-ink">{placedInfo.total}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* Opt-in reminder: works only when the booking reached the base,
                since the deep link carries its id. */}
            {bookingId && (
              <div className="mt-5 rounded-xl bg-surface p-5 text-left">
                <p className="text-sm font-semibold text-ink">{t(TR.remindTitle)}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{t(TR.remindText)}</p>
                <a
                  href={`https://t.me/${MANAGER_BOT}?start=${bookingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press ink-rule rule-slab mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ink/20 px-5 py-3 text-sm font-semibold text-ink hover:border-ink"
                >
                  <BellRing size={16} /> {t(TR.remindBtn)}
                </a>
              </div>
            )}
            <div className="mt-6 space-y-3">
              <a
                href={tgLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press press-slab flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <Send size={18} /> {t(TR.openTg)}
              </a>
              <button
                onClick={handleCopy}
                className="btn-press ink-rule rule-slab flex w-full items-center justify-center gap-2 rounded-lg border border-hairline px-5 py-3.5 text-sm font-semibold text-ink hover:border-ink"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? t(TR.copied) : t(TR.copyMsg)}
              </button>
            </div>
            {/* The button's own label change is not announced — this is. */}
            <p aria-live="polite" className="sr-only">
              {copied ? t(TR.copied) : ''}
            </p>
            {onCancelBooking && (
              <p className="mt-6 border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
                {t(TR.changedMind)}{' '}
                <button
                  onClick={onCancelBooking}
                  className="btn-press ink-rule rule-link rule-short font-semibold text-primary-dark"
                >
                  {t(TR.cancelLink)}
                </button>
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Selected zones — removable chips + running total */}
            <div className="mb-6 rounded-xl bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(TR.yourCombo)}</p>
              {selectedZones.length > 0 ? (
                <>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {selectedZones.map((zone) => (
                      <li key={zone.id}>
                        {onRemoveZone ? (
                          /* The button is the 44px touch target; the inner span
                             keeps the chip visually small. */
                          <button
                            onClick={() => onRemoveZone(zone.id)}
                            aria-label={`${t(TR.removeZone)}: ${getLocalized(zone.name, language)}`}
                            className="group press-inner flex min-h-11 min-w-11 items-center"
                          >
                            <span className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-canvas py-1 pl-3 pr-2 text-xs font-medium text-body transition-colors group-hover:border-danger/40 group-hover:text-danger">
                              {getLocalized(zone.name, language)}
                              <X size={12} className="text-faint transition-colors group-hover:text-danger" />
                            </span>
                          </button>
                        ) : (
                          <span className="block rounded-full border border-ink/15 bg-canvas px-3 py-1 text-xs font-medium text-body">
                            {getLocalized(zone.name, language)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {/* Zones the studio has not priced yet stay out of the sum —
                      showing them inside it would quote a total that is wrong. */}
                  <p className="mt-3 border-t border-ink/10 pt-3 font-serif text-xl font-semibold text-ink">
                    {t(TR.total)}: {calc.pricedZones.length > 0 ? totalLabel : t(PRICE_ON_REQUEST)}
                  </p>
                  {/* Set and percentage are different offers and never both
                      apply: only Рената has sets, and she gives no percentage. */}
                  {calc.appliedSet && (
                    <p className="mt-1 font-sans text-xs font-semibold text-primary-dark">
                      {t(TR.setApplied)}: {setTitle(calc.appliedSet, language)}
                      {calc.setSavings > 0 &&
                        ` · ${t(TR.setSaving).replace('{sum}', formatPrice(calc.setSavings, language))}`}
                    </p>
                  )}
                  {calc.discountPct > 0 && (
                    <p className="mt-1 font-sans text-xs font-semibold text-primary-dark">
                      {t(TR.comboDiscount)} −{calc.discountPct}%
                    </p>
                  )}
                  {/* Before a master is chosen the discount is hers, not the
                      studio's — so it is offered by name and never applied. */}
                  {discountHint && (
                    <p className="mt-1 font-sans text-xs font-medium text-muted">
                      {t(TR.discountWith)
                        .replace('{pct}', String(discountHint.pct))
                        .replace('{masters}', discountHint.masters)}
                    </p>
                  )}
                  {calc.priceVaries && (
                    <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">
                      {t(TR.variesNote)}
                    </p>
                  )}
                  {calc.onRequestZones.length > 0 && (
                    <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">
                      {t(TR.onRequestLead)}{' '}
                      <span className="font-semibold text-body">
                        {calc.onRequestZones.map((z) => getLocalized(z.name, language)).join(', ')}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">{t(TR.noZones)}</p>
              )}
            </div>

            <div className="space-y-6">
              {/* 01 — contacts */}
              <div>
                <StepLabel number="01">{t(TR.stepContacts)}</StepLabel>
                {/* Enter submits, as it would inside a <form>. A real <form> is
                    not usable here: the nine buttons below (masters, dates,
                    slots, zone chips) carry no type="button", so wrapping them
                    would turn picking a date into a submit. */}
                <div className="mt-3 space-y-2.5">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t(TR.name)}
                    aria-label={t(TR.name)}
                    autoComplete="name"
                    maxLength={120}
                    onKeyDown={onFieldKeyDown}
                    className={inputCls}
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={`${t(TR.phone)} · +998 __ ___-__-__`}
                    aria-label={t(TR.phone)}
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={32}
                    onKeyDown={onFieldKeyDown}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* 02 — master cards */}
              <div>
                <StepLabel number="02">{t(TR.stepMaster)}</StepLabel>
                <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t(TR.stepMaster)}>
                  {/* "Любой мастер" is off the table when only one master can do
                      the selection: there is nothing left to choose between. */}
                  <button
                    onClick={() => !soleMaster && setMasterId('')}
                    disabled={Boolean(soleMaster)}
                    aria-pressed={activeMasterId === ''}
                    className={`btn-press ink-rule rule-chip flex items-center gap-2.5 rounded-lg border p-2.5 text-left ${
                      soleMaster
                        ? 'cursor-not-allowed border-hairline/60 bg-surface/50 text-faint'
                        : activeMasterId === ''
                          ? 'border-ink bg-ink text-canvas'
                          : 'border-hairline bg-canvas hover:border-muted'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        activeMasterId === '' ? 'bg-canvas/15 text-canvas' : 'bg-surface text-muted'
                      }`}
                    >
                      ✦
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{t(TR.anyMaster)}</span>
                      <span
                        className={`block truncate text-xs ${
                          activeMasterId === '' ? 'text-canvas/60' : 'text-faint'
                        }`}
                      >
                        {soleMaster ? t(TR.anyMasterOff) : t(TR.anyMasterHint)}
                      </span>
                    </span>
                  </button>
                  {MASTERS.map((master) => {
                    // A master who does not perform every selected zone cannot
                    // be booked for this visit — she would have to refuse it.
                    const canDo = eligibleMasters.includes(master);
                    const selected = activeMasterId === master.id;
                    return (
                      <button
                        key={master.id}
                        onClick={() => canDo && setMasterId(master.id)}
                        disabled={!canDo}
                        aria-pressed={selected}
                        className={`btn-press ink-rule rule-chip flex items-center gap-2.5 rounded-lg border p-2.5 text-left ${
                          !canDo
                            ? 'cursor-not-allowed border-hairline/60 bg-surface/50 text-faint'
                            : selected
                              ? 'border-ink bg-ink text-canvas'
                              : 'border-hairline bg-canvas hover:border-muted'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold ${
                            !canDo
                              ? 'bg-surface text-faint'
                              : selected
                                ? 'bg-canvas/15 text-canvas'
                                : 'bg-primary-soft text-primary-dark'
                          }`}
                        >
                          {masterInitial(master, language)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {getLocalized(master.name, language)}
                          </span>
                          <span className={`block truncate text-xs ${selected ? 'text-canvas/60' : 'text-faint'}`}>
                            {canDo ? getLocalized(master.title, language) : t(TR.masterCantDo)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Why the greyed-out cards are greyed out — a disabled control
                    with no reason reads as a bug. */}
                {restrictedZones.length > 0 && eligibleMasters.length > 0 && (
                  <p className="mt-2.5 text-xs leading-relaxed text-muted">
                    {t(TR.onlyMasterNote)
                      .replace(
                        '{masters}',
                        eligibleMasters.map((m) => getLocalized(m.name, language)).join(', '),
                      )
                      .replace(
                        '{zones}',
                        restrictedZones.map((z) => getLocalized(z.name, language)).join(', '),
                      )}
                  </p>
                )}
                {eligibleMasters.length === 0 && (
                  <p className="mt-2.5 text-xs font-semibold leading-relaxed text-danger">
                    {t(TR.errNoMaster)}
                  </p>
                )}
              </div>

              {/* 03 — date strip + time grid */}
              <div>
                <StepLabel number="03">{t(TR.stepWhen)}</StepLabel>
                <div
                  // overflow-x:auto forces overflow-y:auto, so the focus ring
                  // (2px at 2px offset) needs real padding or it gets clipped.
                  className="scrollbar-none -mx-1 mt-2 flex snap-x gap-2 overflow-x-auto p-1"
                  role="group"
                  aria-label={t(TR.stepWhen)}
                >
                  {days.map((day, i) => {
                    const iso = toIsoDate(day);
                    const selected = date === iso;
                    // Per-master calendars: a day is bookable only if the master
                    // actually works it, or — for "любой мастер" — if anyone who
                    // can do these zones does. Рената's Tue/Thu/Sat autumn rule
                    // therefore greys out the rest of the week for her zones.
                    const closed =
                      unionHoursOn(selectedMaster ? [selectedMaster] : eligibleMasters, iso) ===
                      null;
                    const topLabel = closed
                      ? t(TR.dayOff)
                      : i === 0
                        ? t(TR.today)
                        : i === 1
                          ? t(TR.tomorrow)
                          : weekdayFmt.format(day);
                    return (
                      <button
                        key={iso}
                        onClick={() => !closed && setDate(iso)}
                        disabled={closed}
                        aria-pressed={selected}
                        className={`btn-press ink-rule rule-chip rule-short w-16 shrink-0 snap-start rounded-lg border py-2.5 text-center ${
                          closed
                            ? 'cursor-not-allowed border-hairline/60 bg-surface/50 text-faint'
                            : selected
                              ? 'border-ink bg-ink text-canvas'
                              : 'border-hairline bg-canvas hover:border-muted'
                        }`}
                      >
                        <span className={`block text-[11px] font-medium capitalize ${selected ? 'text-canvas/60' : 'text-faint'}`}>
                          {topLabel}
                        </span>
                        <span className="mt-0.5 block font-serif text-xl font-semibold leading-none">
                          {day.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-faint">{t(TR.dayOffNote)}</p>
                {/* Availability — and now the working window itself — change
                    silently as the date or master is switched; the live region
                    reads both out. */}
                <div aria-live="polite" aria-atomic="true">
                  {workHours && (
                    <p className="mt-2.5 text-xs font-medium text-muted">
                      {t(TR.hoursNote)
                        .replace('{from}', workHours.open)
                        .replace('{to}', workHours.close)}
                    </p>
                  )}
                  {loadingSlots && <p className="mt-3 text-xs text-faint">{t(TR.loadingSlots)}</p>}
                  {availability?.dayClosed && (
                    <p className="mt-3 text-xs font-semibold text-danger">{t(TR.dayClosed)}</p>
                  )}
                  {noHours && !availability?.dayClosed && (
                    <p className="mt-3 text-xs font-semibold text-danger">{t(TR.masterDayOff)}</p>
                  )}
                  {allTaken && !availability?.dayClosed && (
                    <p className="mt-3 text-xs font-semibold text-danger">{t(TR.noSlotsLeft)}</p>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label={t(TR.stepWhen)}>
                  {slots.map((slot) => {
                    const taken = takenSet.has(slot) || pastSet.has(slot) || tooLateSet.has(slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => !taken && setTime(slot)}
                        disabled={taken}
                        aria-pressed={time === slot}
                        aria-label={taken ? `${slot} — ${t(TR.slotTaken)}` : slot}
                        className={
                          taken
                            ? 'min-h-11 cursor-not-allowed rounded-lg border border-hairline/60 bg-surface/50 px-1 text-sm font-medium text-faint line-through'
                            : pillCls(time === slot)
                        }
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                {/* Without this the late slots simply vanish for a long combo
                    and the client thinks the day is fully booked. */}
                {comboDuration > MIN_DURATION_MIN && (
                  <p className="mt-2.5 text-xs leading-relaxed text-faint">
                    {t(TR.comboDuration).replace('{min}', String(comboDuration))}
                  </p>
                )}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t(TR.comment)}
                aria-label={t(TR.comment)}
                rows={2}
                maxLength={1000}
                className={`${inputCls} resize-none`}
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-danger">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-press press-slab mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {t(TR.submit)}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">{t(TR.disclaimer)}</p>
            <p className="mt-2 text-center text-xs leading-relaxed text-faint">
              {t(TR.consentPre)}{' '}
              <a
                href="#/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-muted"
              >
                {t(TR.consentLink)}
              </a>
              .
            </p>
          </>
        )}
      </m.div>
    </div>,
    document.body,
  );
}
