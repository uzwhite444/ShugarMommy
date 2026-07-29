import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Send, Loader2, CheckCircle2, Copy, Check } from 'lucide-react';
import { LanguageCode, ServiceZone } from '../types';
import { calcTotal, formatPrice, getLocalized, MANAGER_TELEGRAM, WORK_HOURS } from '../utils';
import { MASTERS } from '../data';
import { createBooking } from '../lib/bookings';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface BookingModalProps {
  language: LanguageCode;
  selectedZones: ServiceZone[];
  onClose: () => void;
  /** Removes a zone straight from the summary chips. */
  onRemoveZone?: (zoneId: string) => void;
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
  comment: { RU: 'Комментарий (необязательно)', UZ: 'Izoh (ixtiyoriy)', EN: 'Comment (optional)' },
  submit: { RU: 'Отправить заявку в Telegram', UZ: 'Arizani Telegramga yuborish', EN: 'Send request via Telegram' },
  disclaimer: {
    RU: 'Откроется чат с администратором в Telegram — подтвердим свободное время и запишем вас.',
    UZ: 'Telegramda administrator bilan chat ochiladi — bo‘sh vaqtni tasdiqlab, sizni yozamiz.',
    EN: 'A Telegram chat with our administrator opens — we confirm the slot and book you in.',
  },
  errFill: { RU: 'Укажите имя и телефон.', UZ: 'Ism va telefonni kiriting.', EN: 'Please enter your name and phone.' },
  errDate: { RU: 'Выберите дату и время.', UZ: 'Sana va vaqtni tanlang.', EN: 'Please pick a date and time.' },
  doneTitle: { RU: 'Заявка готова!', UZ: 'Ariza tayyor!', EN: 'Request ready!' },
  doneText: {
    RU: 'Если Telegram не открылся автоматически — нажмите кнопку ниже или скопируйте текст заявки.',
    UZ: 'Telegram avtomatik ochilmasa — quyidagi tugmani bosing yoki ariza matnini nusxalang.',
    EN: 'If Telegram did not open automatically, use the button below or copy the request text.',
  },
  openTg: { RU: 'Открыть Telegram', UZ: 'Telegramni ochish', EN: 'Open Telegram' },
  copyMsg: { RU: 'Скопировать заявку', UZ: 'Arizani nusxalash', EN: 'Copy request' },
  copied: { RU: 'Скопировано!', UZ: 'Nusxalandi!', EN: 'Copied!' },
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

export default function BookingModal({ language, selectedZones, onClose, onRemoveZone }: BookingModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);

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

  const t = (loc: (typeof TR)[keyof typeof TR]) => getLocalized(loc, language);
  const calc = calcTotal(selectedZones);
  const tgLink = `https://t.me/${MANAGER_TELEGRAM}?text=${encodeURIComponent(requestMsg)}`;

  const days = useMemo(() => buildDays(), []);
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[language], { weekday: 'short' }),
    [language],
  );

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError(t(TR.errFill));
      return;
    }
    if (!date || !time) {
      setError(t(TR.errDate));
      return;
    }
    setError('');

    const master = MASTERS.find((m) => m.id === masterId);
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
      const discountNote = calc.discountPct > 0 ? ` (−${calc.discountPct}%)` : '';
      message += `💰 ${labels.total}: ${formatPrice(calc.total, language)}${discountNote}\n`;
    }
    message += `\n👤 ${labels.name}: ${name.trim()}\n📞 ${labels.phone}: ${phone.trim()}`;
    if (comment.trim()) message += `\n💬 ${labels.comment}: ${comment.trim()}`;

    // Persist to the backend (Telegram still opens even if this fails).
    setSubmitting(true);
    await createBooking({
      customer_name: name.trim(),
      phone: phone.trim(),
      services: servicesText,
      master: master ? master.name : null,
      visit_date: date,
      visit_time: time,
      total_price: calc.total,
      comment: comment.trim() || null,
    });
    setSubmitting(false);

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
    `btn-press rounded-lg border px-1 py-2 text-sm font-medium transition-colors ${
      selected
        ? 'border-ink bg-ink text-canvas'
        : 'border-hairline bg-canvas text-body hover:border-muted'
    }`;

  return (
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
                    {calc.discountPct > 0 && (
                      <span className="ml-2 font-sans text-sm font-semibold text-primary-dark">−{calc.discountPct}%</span>
                    )}
                  </p>
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
                            {getLocalized(master.role, language)}
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
                    const topLabel =
                      i === 0 ? t(TR.today) : i === 1 ? t(TR.tomorrow) : weekdayFmt.format(day);
                    return (
                      <button
                        key={iso}
                        onClick={() => setDate(iso)}
                        aria-pressed={selected}
                        className={`btn-press w-16 shrink-0 snap-start rounded-lg border py-2.5 text-center transition-colors ${
                          selected ? 'border-ink bg-ink text-canvas' : 'border-hairline bg-canvas hover:border-muted'
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
                <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label={t(TR.stepWhen)}>
                  {buildTimeSlots().map((slot) => (
                    <button key={slot} onClick={() => setTime(slot)} aria-pressed={time === slot} className={pillCls(time === slot)}>
                      {slot}
                    </button>
                  ))}
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
          </>
        )}
      </motion.div>
    </div>
  );
}
