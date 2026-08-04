import { MapPin, Phone, Clock, Send, Instagram } from 'lucide-react';
import Reveal from './ui/Reveal';
import SplitWords from './ui/SplitWords';
import { LanguageCode } from '../types';
import { ADDRESS, getLocalized, INSTAGRAM, MANAGER_TELEGRAM, PHONE, WORK_HOURS } from '../utils';

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

  const cards: Array<{
    icon: typeof MapPin;
    label: string;
    value: string;
    href?: string;
    note?: string;
  }> = [
    { icon: MapPin, label: getLocalized(TR.address, language), value: getLocalized(ADDRESS, language) },
    { icon: Phone, label: getLocalized(TR.phone, language), value: PHONE, href: phoneHref },
    {
      icon: Clock,
      label: getLocalized(TR.hours, language),
      value: `${getLocalized(TR.weekdays, language)} ${WORK_HOURS.open} – ${WORK_HOURS.close}`,
      note: getLocalized(TR.sunday, language),
    },
  ];

  return (
    <section id="contacts" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card, i) => (
            <Reveal key={card.label} delay={i * 0.06}>
              <div className="h-full rounded-xl bg-surface p-7 transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <card.icon size={20} className="text-primary" strokeWidth={1.75} />
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{card.label}</p>
                {card.href ? (
                  <a href={card.href} className="mt-1.5 block font-medium text-ink hover:text-primary-dark">
                    {card.value}
                  </a>
                ) : (
                  <p className="mt-1.5 font-medium text-ink">{card.value}</p>
                )}
                {card.note && <p className="mt-2 text-xs leading-relaxed text-muted">{card.note}</p>}
              </div>
            </Reveal>
          ))}
        </div>

        {/* Self-service cancellation */}
        <Reveal delay={0.08}>
          <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-xl border border-hairline p-6 sm:flex-row sm:items-center sm:p-7">
            <div>
              <p className="font-semibold text-ink">{getLocalized(TR.cancelTitle, language)}</p>
              <p className="mt-1 text-sm text-muted">{getLocalized(TR.cancelText, language)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={onCancelBooking}
                className="btn-press rounded-lg border border-ink/20 px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink"
              >
                {getLocalized(TR.cancelBtn, language)}
              </button>
              <a
                href={phoneHref}
                className="btn-press inline-flex items-center gap-2 rounded-lg border border-hairline px-5 py-2.5 text-sm font-semibold text-muted hover:border-muted hover:text-ink"
              >
                <Phone size={15} /> {getLocalized(TR.callBtn, language)}
              </a>
            </div>
          </div>
        </Reveal>

        {/* Dark pre-footer CTA band — the page's single dark moment before the footer */}
        <Reveal delay={0.1}>
          <div className="mt-14 rounded-2xl bg-dark px-7 py-12 text-center sm:px-10 sm:py-16">
            <h3 className="display text-3xl text-ondark sm:text-5xl">
              <SplitWords text={getLocalized(TR.ctaTitle, language)} inView />
            </h3>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ondark-soft sm:text-base">
              {getLocalized(TR.ctaText, language)}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={`https://t.me/${MANAGER_TELEGRAM}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <Send size={16} /> Telegram
              </a>
              <a
                href={`https://instagram.com/${INSTAGRAM}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-ondark/25 px-6 py-3 text-sm font-semibold text-ondark transition-colors hover:border-ondark"
              >
                <Instagram size={16} /> Instagram
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
