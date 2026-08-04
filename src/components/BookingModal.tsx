import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Send, Loader2, CheckCircle2, Copy, Check, BellRing } from 'lucide-react';
import { LanguageCode, ServiceZone } from '../types';
import {
  calcTotal,
  DAY_OFF,
  formatPrice,
  getLocalized,
  MANAGER_BOT,
  MANAGER_TELEGRAM,
  WORK_HOURS,
} from '../utils';
import { MASTERS } from '../data';
import { createBooking } from '../lib/bookings';
import { fetchDayAvailability, isSlotTaken, type DayAvailability } from '../lib/availability';
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
  setDiscount: { RU: 'сет', UZ: 'set', EN: 'set' },
  masterDiscount: { RU: 'мастер', UZ: 'usta', EN: 'master' },
  stepContacts: { RU: 'Ваши данные', UZ: "Ma'lumotlaringiz", EN: 'Your details' },
  stepMaster: { RU: 'Мастер', UZ: 'Usta', EN: 'Master' },
  stepWhen: { RU: 'Дата и время', UZ: 'Sana va vaqt', EN: 'Date & time' },
  name: { RU: 'Ваше имя', UZ: 'Ismingiz', EN: 'Your name' },
  phone: { RU: 'Телефон', UZ: 'Telefon', EN: 'Phone' },
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
  errTaken: {
    RU: 'Это время уже занято — выберите другое.',
    UZ: 'Bu vaqt band — boshqasini tanlang.',
    EN: 'That time is taken — please pick another.',
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

/** 30-minute slots between opening and one hour before closing. */
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  const [openH] = WORK_HOURS.open.split(':').map(Number);
  const [closeH] = WORK_HOURS.close.split(':').map(Number);
  for (let h = openH; h < closeH; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

/** Next `count` days starting today, as local dates. */
function buildDays(count = 14): Date[] {
  const today = new Date();
  return Array.from(
    { length: count },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
  );
}

/** Local YYYY-MM-DD (no UTC shift). */
function toIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

  const t = (loc: (typeof TR)[keyof typeof TR]) => getLocalized(loc, language);
  const selectedMaster = MASTERS.find((m) => m.id === masterId);
  const calc = calcTotal(selectedZones, selectedMaster?.discountPct ?? 0);
  const tgLink = `https://t.me/${MANAGER_TELEGRAM}?text=${encodeURIComponent(requestMsg)}`;

  const days = useMemo(() => buildDays(), []);
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[language], { weekday: 'short' }),
    [language],
  );

  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const selectedMasterName = selectedMaster?.name ?? null;

  // Load real availability whenever the customer picks a date. A stale flag
  // guards against out-of-order responses when dates are switched quickly.
  useEffect(() => {
    if (!date) {
      setAvailability(null);
      return;
    }
    let stale = false;
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

  const slots = useMemo(() => buildTimeSlots(), []);
  const takenSet = useMemo(() => {
    if (!availability) return new Set<string>();
    return new Set(slots.filter((slot) => isSlotTaken(availability, slot, selectedMasterName)));
  }, [availability, slots, selectedMasterName]);

  // Switching to a master who is busy at the chosen time clears the choice,
  // so a taken slot can never be submitted.
  useEffect(() => {
    if (time && takenSet.has(time)) setTime('');
  }, [takenSet, time]);

  const allTaken = Boolean(date) && !loadingSlots && takenSet.size >= slots.length;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError(t(TR.errFill));
      return;
    }
    if (!date || !time) {
      setError(t(TR.errDate));
      return;
    }
    // Someone may have taken the slot while the form was open.
    const fresh = await fetchDayAvailability(date);
    if (isSlotTaken(fresh, time, selectedMasterName)) {
      setAvailability(fresh);
      setTime('');
      setError(t(TR.errTaken));
      return;
    }
    setError('');

    const master = selectedMaster;
    const masterName = master ? master.name : t(TR.anyMaster);
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
        ? { services: 'Зоны', master: 'Мастер', date: 'Дата', time: 'Время', total: 'Итого', name: 'Имя', phone: 'Телефон', comment: 'Комментарий' }
        : language === 'UZ'
          ? { services: 'Zonalar', master: 'Usta', date: 'Sana', time: 'Vaqt', total: 'Jami', name: 'Ism', phone: 'Telefon', comment: 'Izoh' }
          : { services: 'Zones', master: 'Master', date: 'Date', time: 'Time', total: 'Total', name: 'Name', phone: 'Phone', comment: 'Comment' };

    let message = `${greeting}\n\n`;
    message += `💆‍♀️ ${labels.services}: ${servicesText}\n`;
    message += `👩‍🔬 ${labels.master}: ${masterName}\n`;
    message += `📅 ${labels.date}: ${date}\n`;
    message += `🕐 ${labels.time}: ${time}\n`;
    if (selectedZones.length > 0) {
      const notes = [
        calc.discountPct > 0 ? `сет −${calc.discountPct}%` : '',
        calc.masterDiscountPct > 0 ? `мастер −${calc.masterDiscountPct}%` : '',
      ].filter(Boolean);
      const discountNote = notes.length > 0 ? ` (${notes.join(', ')})` : '';
      message += `💰 ${labels.total}: ${formatPrice(calc.total, language)}${discountNote}\n`;
    }
    message += `\n👤 ${labels.name}: ${name.trim()}\n📞 ${labels.phone}: ${phone.trim()}`;
    if (comment.trim()) message += `\n💬 ${labels.comment}: ${comment.trim()}`;

    // Persist to the backend (Telegram still opens even if this fails).
    setSubmitting(true);
    const newId = await createBooking({
      customer_name: name.trim(),
      phone: phone.trim(),
      services: servicesText,
      master: master ? master.name : null,
      visit_date: date,
      visit_time: time,
      total_price: calc.total,
      comment: comment.trim() || null,
      source: getSource(),
    });
    setSubmitting(false);

    setBookingId(newId);
    setRequestMsg(message);
    setPlaced(true);

    // window.open('_blank') is often blocked inside in-app browsers, so we
    // also keep the manual link + copy fallback on the confirmation screen.
    const link = `https://t.me/${MANAGER_TELEGRAM}?text=${encodeURIComponent(message)}`;
    window.open(link, '_blank', 'noopener');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the manual Telegram link still works.
    }
  };

  const inputCls =
    'w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-primary';

  const pillCls = (selected: boolean) =>
    `btn-press min-h-11 rounded-lg border px-1 text-sm font-medium transition-colors ${
      selected
        ? 'border-ink bg-ink text-canvas'
        : 'border-hairline bg-canvas text-body hover:border-muted'
    }`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={t(TR.title)}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-canvas p-6 shadow-2xl sm:rounded-2xl sm:p-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display text-3xl text-ink">{t(TR.title)}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-muted hover:text-ink">
            <X size={22} />
          </button>
        </div>

        {placed ? (
          <div className="text-center">
            <CheckCircle2 size={56} className="mx-auto text-success" />
            <h3 className="display mt-4 text-2xl text-ink">{t(TR.doneTitle)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(TR.doneText)}</p>

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
                  className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ink/20 px-5 py-3 text-sm font-semibold text-ink hover:border-ink"
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
                className="btn-press flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <Send size={18} /> {t(TR.openTg)}
              </a>
              <button
                onClick={handleCopy}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-lg border border-hairline px-5 py-3.5 text-sm font-semibold text-ink hover:border-ink"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? t(TR.copied) : t(TR.copyMsg)}
              </button>
            </div>
            {onCancelBooking && (
              <p className="mt-6 border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
                {t(TR.changedMind)}{' '}
                <button
                  onClick={onCancelBooking}
                  className="font-semibold text-primary-dark underline underline-offset-2 hover:no-underline"
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
                          <button
                            onClick={() => onRemoveZone(zone.id)}
                            className="group flex items-center gap-1.5 rounded-full border border-ink/15 bg-canvas py-1 pl-3 pr-2 text-xs font-medium text-body transition-colors hover:border-danger/40 hover:text-danger"
                          >
                            {getLocalized(zone.name, language)}
                            <X size={12} className="text-faint transition-colors group-hover:text-danger" />
                          </button>
                        ) : (
                          <span className="block rounded-full border border-ink/15 bg-canvas px-3 py-1 text-xs font-medium text-body">
                            {getLocalized(zone.name, language)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-ink/10 pt-3 font-serif text-xl font-semibold text-ink">
                    {t(TR.total)}: {formatPrice(calc.total, language)}
                  </p>
                  {(calc.discountPct > 0 || calc.masterDiscountPct > 0) && (
                    <p className="mt-1 font-sans text-xs font-semibold text-primary-dark">
                      {[
                        calc.discountPct > 0 ? `${t(TR.setDiscount)} −${calc.discountPct}%` : '',
                        calc.masterDiscountPct > 0
                          ? `${t(TR.masterDiscount)} −${calc.masterDiscountPct}%`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
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
                <div className="mt-3 space-y-2.5">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t(TR.name)}
                    aria-label={t(TR.name)}
                    autoComplete="name"
                    maxLength={120}
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
                    className={inputCls}
                  />
                </div>
              </div>

              {/* 02 — master cards */}
              <div>
                <StepLabel number="02">{t(TR.stepMaster)}</StepLabel>
                <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t(TR.stepMaster)}>
                  <button
                    onClick={() => setMasterId('')}
                    aria-pressed={masterId === ''}
                    className={`btn-press flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                      masterId === '' ? 'border-ink bg-ink text-canvas' : 'border-hairline bg-canvas hover:border-muted'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        masterId === '' ? 'bg-canvas/15 text-canvas' : 'bg-surface text-muted'
                      }`}
                    >
                      ✦
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{t(TR.anyMaster)}</span>
                      <span className={`block truncate text-xs ${masterId === '' ? 'text-canvas/60' : 'text-faint'}`}>
                        {t(TR.anyMasterHint)}
                      </span>
                    </span>
                  </button>
                  {MASTERS.map((master) => {
                    const selected = masterId === master.id;
                    return (
                      <button
                        key={master.id}
                        onClick={() => setMasterId(master.id)}
                        aria-pressed={selected}
                        className={`btn-press flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                          selected ? 'border-ink bg-ink text-canvas' : 'border-hairline bg-canvas hover:border-muted'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold ${
                            selected ? 'bg-canvas/15 text-canvas' : 'bg-primary-soft text-primary-dark'
                          }`}
                        >
                          {master.initials}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{master.name}</span>
                          <span className={`block truncate text-xs ${selected ? 'text-canvas/60' : 'text-faint'}`}>
                            {master.discountPct > 0 ? (
                              <span className={selected ? 'text-canvas' : 'font-semibold text-primary-dark'}>
                                −{master.discountPct}% к прайсу
                              </span>
                            ) : (
                              getLocalized(master.role, language)
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 03 — date strip + time grid */}
              <div>
                <StepLabel number="03">{t(TR.stepWhen)}</StepLabel>
                <div
                  className="scrollbar-none -mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
                  role="group"
                  aria-label={t(TR.stepWhen)}
                >
                  {days.map((day, i) => {
                    const iso = toIsoDay(day);
                    const selected = date === iso;
                    const closed = day.getDay() === DAY_OFF;
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
                        className={`btn-press w-16 shrink-0 snap-start rounded-lg border py-2.5 text-center transition-colors ${
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
                {loadingSlots && <p className="mt-3 text-xs text-faint">{t(TR.loadingSlots)}</p>}
                {availability?.dayClosed && (
                  <p className="mt-3 text-xs font-semibold text-danger">{t(TR.dayClosed)}</p>
                )}
                {allTaken && !availability?.dayClosed && (
                  <p className="mt-3 text-xs font-semibold text-danger">{t(TR.noSlotsLeft)}</p>
                )}
                <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label={t(TR.stepWhen)}>
                  {slots.map((slot) => {
                    const taken = takenSet.has(slot);
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

            {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
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
      </motion.div>
    </div>,
    document.body,
  );
}
