import { useRef } from 'react';
import { m, useInView, useReducedMotion } from 'motion/react';
import { MapPin, Phone, Clock, Send, Instagram } from 'lucide-react';
import Reveal from './ui/Reveal';
import SectionHead from './ui/SectionHead';
import SplitWords from './ui/SplitWords';
import { Stagger, StaggerItem } from './ui/Stagger';
import { DUR, EASE_INK, VIEW } from '../lib/motion';
import { MASTERS, toIsoDate } from '../data';
import { LanguageCode, Master, WorkWindow } from '../types';
import { ADDRESS, getLocalized, INSTAGRAM, MANAGER_TELEGRAM, PHONE, STUDIO_HOURS } from '../utils';

/** Date.getDay() index → short weekday name. */
const WEEKDAY_SHORT: Record<LanguageCode, readonly string[]> = {
  RU: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  UZ: ['yak', 'du', 'se', 'chor', 'pay', 'ju', 'sha'],
  EN: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const DATE_LOCALE: Record<LanguageCode, string> = { RU: 'ru-RU', UZ: 'uz-UZ', EN: 'en-US' };

/** "2026-09-01" → "1 сентября" / "1 sentabr" / "September 1". */
function formatDay(iso: string, lang: LanguageCode): string {
  // Midnight-local parse, never Date(iso): the bare form is read as UTC and
  // Asia/Tashkent (UTC+5) would render the previous day.
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: 'numeric', month: 'long' }).format(
    new Date(`${iso}T00:00:00`),
  );
}

/** «С 1 сентября — Рената: вт, чт, сб» */
function changeLine(date: string, name: string, days: string, lang: LanguageCode): string {
  if (lang === 'UZ') return `${date}dan — ${name}: ${days}`;
  if (lang === 'EN') return `From ${date} — ${name}: ${days}`;
  return `С ${date} — ${name}: ${days}`;
}

/**
 * The widest window this master ever works, across all her schedule rules.
 * Display copy only — whether she works a GIVEN day is masterHoursOn()'s job,
 * and the booking grid must keep asking that instead of reading this.
 */
function scheduleWindow(master: Master): WorkWindow | null {
  // Not named `window`: shadowing the DOM global here confused inference into
  // resolving `.open` against Window instead of WorkWindow.
  let widest: WorkWindow | null = null;
  for (const rule of master.schedule) {
    if (widest === null) {
      widest = { open: rule.open, close: rule.close };
      continue;
    }
    if (rule.open < widest.open) widest = { ...widest, open: rule.open };
    if (rule.close > widest.close) widest = { ...widest, close: rule.close };
  }
  return widest;
}

interface ContactsProps {
  language: LanguageCode;
  onCancelBooking: () => void;
}

const TR = {
  eyebrow: { RU: 'Контакты', UZ: 'Aloqa', EN: 'Contacts' },
  title: { RU: 'Мы рядом', UZ: 'Biz yaqinmiz', EN: 'Find us' },
  address: { RU: 'Адрес', UZ: 'Manzil', EN: 'Address' },
  phone: { RU: 'Телефон', UZ: 'Telefon', EN: 'Phone' },
  hours: { RU: 'Режим работы', UZ: 'Ish vaqti', EN: 'Working hours' },
  weekdays: { RU: 'Пн–Сб', UZ: 'Du–Sha', EN: 'Mon–Sat' },
  byMaster: { RU: 'Часы по мастерам', UZ: 'Ustalar bo‘yicha soatlar', EN: 'Hours by master' },
  sunday: {
    RU: 'Вс — выходной. Выход мастера по двойному тарифу — по договорённости.',
    UZ: 'Yakshanba — dam olish kuni. Usta ikki baravar tarif bilan chiqadi — kelishuv asosida.',
    EN: 'Sun — closed. A master can come in at double rate by arrangement.',
  },
  ctaTitle: {
    RU: 'Готовы к гладкой коже?',
    UZ: 'Silliq teriga tayyormisiz?',
    EN: 'Ready for smooth skin?',
  },
  ctaText: {
    RU: 'Напишите нам — подберём удобное время и ответим на вопросы.',
    UZ: 'Bizga yozing — qulay vaqtni tanlab, savollarga javob beramiz.',
    EN: 'Write to us — we will find a convenient time and answer your questions.',
  },
  cancelTitle: { RU: 'Нужно отменить запись?', UZ: 'Yozuvni bekor qilish kerakmi?', EN: 'Need to cancel?' },
  cancelText: {
    RU: 'Отмените онлайн за пару секунд или позвоните нам — мы всё поймём.',
    UZ: 'Bir necha soniyada onlayn bekor qiling yoki qo‘ng‘iroq qiling — tushunamiz.',
    EN: 'Cancel online in seconds or just call us — we understand.',
  },
  cancelBtn: { RU: 'Отменить запись', UZ: 'Yozuvni bekor qilish', EN: 'Cancel booking' },
  callBtn: { RU: 'Позвонить', UZ: 'Qo‘ng‘iroq qilish', EN: 'Call us' },
};

export default function Contacts({ language, onCancelBooking }: ContactsProps) {
  const phoneHref = `tel:${PHONE.replace(/[^+\d]/g, '')}`;
  const reduced = useReducedMotion();
  const bandRef = useRef<HTMLDivElement>(null);
  const bandIn = useInView(bandRef, VIEW.far);
  const bandOn = reduced ? true : bandIn;

  // Every master keeps her own hours now, so the headline range is the studio
  // envelope and the rows below say who is actually in at the edges of it.
  const masterRows = MASTERS.map((master) => ({ master, window: scheduleWindow(master) })).flatMap(
    ({ master, window }) =>
      window ? [{ name: getLocalized(master.name, language), hours: `${window.open} – ${window.close}` }] : [],
  );

  // A master's row above is one window — it cannot say "these days, from that
  // date", and Рената moves to every other day on 1 September. Derived from the
  // schedule rules, so the line retires itself once the date passes instead of
  // becoming a stale promise.
  const todayIso = toIsoDate(new Date());
  const scheduleChanges = MASTERS.flatMap((master) =>
    master.schedule.flatMap((rule) => {
      const from = rule.effectiveFrom;
      if (from === null || from <= todayIso) return [];
      const days = [...rule.weekdays]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_SHORT[language][day] ?? '')
        .filter(Boolean)
        .join(', ');
      return [changeLine(formatDay(from, language), getLocalized(master.name, language), days, language)];
    }),
  );

  const cards: Array<{
    icon: typeof MapPin;
    label: string;
    value: string;
    href?: string;
    note?: string;
    changes?: string[];
    rows?: Array<{ name: string; hours: string }>;
    rowsLabel?: string;
  }> = [
    { icon: MapPin, label: getLocalized(TR.address, language), value: getLocalized(ADDRESS, language) },
    { icon: Phone, label: getLocalized(TR.phone, language), value: PHONE, href: phoneHref },
    {
      icon: Clock,
      label: getLocalized(TR.hours, language),
      value: `${getLocalized(TR.weekdays, language)} ${STUDIO_HOURS.open} – ${STUDIO_HOURS.close}`,
      rows: masterRows,
      rowsLabel: getLocalized(TR.byMaster, language),
      changes: scheduleChanges,
      note: getLocalized(TR.sunday, language),
    },
  ];

  return (
    <section id="contacts" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow={getLocalized(TR.eyebrow, language)} title={getLocalized(TR.title, language)} />

        <Stagger className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3" delay={0.12}>
          {cards.map((card) => (
            <StaggerItem key={card.label} variant="plate">
              <div className="ink-rule rule-top rule-long h-full rounded-xl bg-surface p-7">
                <card.icon size={20} className="text-primary" strokeWidth={1.75} />
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{card.label}</p>
                {card.href ? (
                  // Full-width 44px row: tapping the phone number on a small
                  // screen must not require hitting a 24px line of text.
                  // No rule here on purpose: the card already inks its top edge
                  // on the same hover, and a full-bleed rule under a short
                  // number would read as a divider, not an underline.
                  <a
                    href={card.href}
                    className="btn-press -mx-2 mt-0.5 flex min-h-11 items-center rounded-lg px-2 font-medium text-ink hover:text-primary-dark"
                  >
                    {card.value}
                  </a>
                ) : (
                  <p className="mt-1.5 font-medium text-ink">{card.value}</p>
                )}
                {card.rows && card.rows.length > 0 && (
                  <>
                    <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">
                      {card.rowsLabel}
                    </p>
                    <dl className="mt-1.5 space-y-1">
                      {card.rows.map((row) => (
                        <div key={row.name} className="flex items-baseline justify-between gap-3 text-sm">
                          <dt className="text-muted">{row.name}</dt>
                          <dd className="shrink-0 font-medium text-body tabular-nums">{row.hours}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                {card.changes && card.changes.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {card.changes.map((line) => (
                      <li key={line} className="text-xs leading-relaxed text-primary-dark">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                {card.note && <p className="mt-4 text-xs leading-relaxed text-muted">{card.note}</p>}
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Self-service cancellation */}
        <Reveal variant="plate">
          <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-xl border border-hairline p-6 sm:flex-row sm:items-center sm:p-7">
            <div>
              <p className="font-semibold text-ink">{getLocalized(TR.cancelTitle, language)}</p>
              <p className="mt-1 text-sm text-muted">{getLocalized(TR.cancelText, language)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={onCancelBooking}
                className="btn-press ink-rule rule-slab flex min-h-11 items-center rounded-lg border border-ink/20 px-5 text-sm font-semibold text-ink hover:border-ink"
              >
                {getLocalized(TR.cancelBtn, language)}
              </button>
              <a
                href={phoneHref}
                className="btn-press ink-rule rule-slab inline-flex min-h-11 items-center gap-2 rounded-lg border border-hairline px-5 text-sm font-semibold text-muted hover:border-muted hover:text-ink"
              >
                <Phone size={15} /> {getLocalized(TR.callBtn, language)}
              </a>
            </div>
          </div>
        </Reveal>

        {/* Dark pre-footer CTA band — the page's single dark moment before the
            footer, and the page's third and last masked word-rise. ONE observer
            drives the band and the words: this used to be a Reveal with a -60px
            margin wrapping a SplitWords with an -80px margin of its own, so the
            container and its own headline could disagree about when the moment
            had started. `veil` keeps the wrapper transform-free, which matters
            here because each word rises inside its own overflow mask. */}
        <m.div
          ref={bandRef}
          initial={reduced ? false : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: bandOn ? 1 : 0 }}
          transition={{ duration: DUR.slow, ease: EASE_INK }}
        >
          <div className="mt-14 rounded-2xl bg-dark px-7 py-12 text-center sm:px-10 sm:py-16">
            <h3 className="display text-3xl text-ondark sm:text-5xl">
              <SplitWords text={getLocalized(TR.ctaTitle, language)} start={bandOn} delay={0.12} />
            </h3>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ondark-soft sm:text-base">
              {getLocalized(TR.ctaText, language)}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={`https://t.me/${MANAGER_TELEGRAM}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press press-slab inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <Send size={16} /> Telegram
              </a>
              <a
                href={`https://instagram.com/${INSTAGRAM}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press ink-rule rule-slab rule-on-dark inline-flex items-center gap-2 rounded-lg border border-ondark/25 px-6 py-3 text-sm font-semibold text-ondark hover:border-ondark"
              >
                <Instagram size={16} /> Instagram
              </a>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
