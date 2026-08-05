import { useRef } from 'react';
import { m, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { Check } from 'lucide-react';
import { LanguageCode } from '../types';
import { formatPrice, getLocalized } from '../utils';

interface HeroProps {
  language: LanguageCode;
  onBook: () => void;
}

const TR = {
  eyebrow: { RU: 'Студия шугаринга — Андижан', UZ: 'Shugaring studiyasi — Andijon', EN: 'Sugaring studio — Andijan' },
  title1: { RU: 'Кожа, к которой', UZ: 'Teginish istagini', EN: "Skin you can't" },
  title2: { RU: 'хочется прикасаться', UZ: 'uyg‘otadigan teri', EN: 'help but touch' },
  subtitle: {
    RU: 'Натуральная сахарная паста, стерильность медицинского уровня и мастера, которым доверяют. Запись онлайн занимает минуту.',
    UZ: 'Tabiiy shakar pastasi, tibbiy darajadagi sterillik va ishonchli ustalar. Onlayn yozilish bir daqiqa oladi.',
    EN: 'Natural sugar paste, medical-grade sterility and masters you can trust. Booking online takes a minute.',
  },
  cta: { RU: 'Записаться онлайн', UZ: 'Onlayn yozilish', EN: 'Book online' },
  ctaPrices: { RU: 'Смотреть цены', UZ: "Narxlarni ko'rish", EN: 'See prices' },
  points: [
    { RU: 'Гипоаллергенная паста — сахар, вода, лимон', UZ: 'Gipoallergen pasta — shakar, suv, limon', EN: 'Hypoallergenic paste — sugar, water, lemon' },
    { RU: 'Одноразовые материалы на каждой процедуре', UZ: 'Har muolajada bir martalik materiallar', EN: 'Single-use materials at every visit' },
    { RU: 'Гладкость до трёх недель', UZ: 'Uch haftagacha silliqlik', EN: 'Smoothness for up to three weeks' },
  ],
  /* Booking-preview card (static product mock, like a receipt) */
  mockTitle: { RU: 'Ваша запись', UZ: 'Sizning yozuvingiz', EN: 'Your booking' },
  mockZone1: { RU: 'Бикини глубокое', UZ: 'Chuqur bikini', EN: 'Deep bikini' },
  mockZone2: { RU: 'Ноги полностью', UZ: "Oyoqlar to'liq", EN: 'Full legs' },
  mockZone3: { RU: 'Подмышки', UZ: "Qo'ltiq osti", EN: 'Underarms' },
  mockDiscount: { RU: 'Скидка за комплекс', UZ: 'Kompleks chegirmasi', EN: 'Combo discount' },
  mockTotal: { RU: 'Итого', UZ: 'Jami', EN: 'Total' },
  mockCta: { RU: 'Отправить заявку', UZ: 'Ariza yuborish', EN: 'Send request' },
  mockNote: { RU: 'Подтвердим время в Telegram', UZ: 'Vaqtni Telegramda tasdiqlaymiz', EN: 'We confirm the time on Telegram' },
};

const MOCK_ROWS = [
  { name: TR.mockZone1, price: 150_000 },
  { name: TR.mockZone2, price: 160_000 },
  { name: TR.mockZone3, price: 50_000 },
];

export default function Hero({ language, onBook }: HeroProps) {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const subtotal = MOCK_ROWS.reduce((s, r) => s + r.price, 0);
  const discount = Math.round(subtotal * 0.1);

  // Gentle parallax: the receipt card trails the scroll by a few px.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const rawCardY = useTransform(scrollYProgress, [0, 1], [0, 56]);
  const cardY = useSpring(rawCardY, { stiffness: 120, damping: 24 });

  const fadeUp = (delay: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 16, filter: 'blur(6px)' },
    animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  // The <h1> is the LCP element: it paints fully opaque on the very first
  // frame and only settles a few pixels via transform, so the largest text
  // never waits on an opacity or blur animation.
  const headingLine = (delay: number) => ({
    initial: reduced ? false : { y: '0.16em' },
    animate: reduced ? undefined : { y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section
      ref={sectionRef}
      id="top"
      className="border-b border-hairline bg-canvas px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
        {/* Left — editorial copy */}
        <div>
          <m.p {...fadeUp(0)} className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </m.p>
          <h1 className="display mt-5 text-5xl text-ink sm:text-6xl lg:text-7xl">
            <m.span {...headingLine(0)} className="inline-block">
              {getLocalized(TR.title1, language)}
            </m.span>
            <br />
            <m.span {...headingLine(0.08)} className="inline-block text-primary">
              {getLocalized(TR.title2, language)}
            </m.span>
          </h1>
          <m.p {...fadeUp(0.16)} className="mt-6 max-w-md text-base leading-relaxed text-body sm:text-lg">
            {getLocalized(TR.subtitle, language)}
          </m.p>

          <m.div {...fadeUp(0.24)} className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onBook}
              className="btn-press rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              {getLocalized(TR.cta, language)}
            </button>
            <a
              href="#services"
              className="btn-press rounded-lg border border-hairline bg-canvas px-6 py-3.5 text-sm font-semibold text-ink hover:border-muted"
            >
              {getLocalized(TR.ctaPrices, language)}
            </a>
          </m.div>

          <m.ul {...fadeUp(0.32)} className="mt-10 space-y-3 border-t border-hairline pt-8">
            {TR.points.map((point) => (
              <li key={point.EN} className="flex items-start gap-3 text-sm text-body">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                {getLocalized(point, language)}
              </li>
            ))}
          </m.ul>
        </div>

        {/* Right — the product itself: a quiet booking-receipt preview */}
        <m.div {...fadeUp(0.25)} aria-hidden className="lg:justify-self-end">
          <m.div
            style={reduced ? undefined : { y: cardY }}
            className="w-full max-w-sm rounded-2xl bg-surface p-7 sm:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {getLocalized(TR.mockTitle, language)}
            </p>
            <ul className="mt-5 space-y-3.5">
              {MOCK_ROWS.map((row) => (
                <li key={row.name.EN} className="flex items-baseline justify-between gap-4 text-sm text-body">
                  <span>{getLocalized(row.name, language)}</span>
                  <span className="font-medium text-ink">{formatPrice(row.price, language)}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-3.5 text-sm text-primary-dark">
                <span>{getLocalized(TR.mockDiscount, language)} −10%</span>
                <span className="font-medium">−{formatPrice(discount, language)}</span>
              </li>
            </ul>
            <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-5">
              <span className="text-sm font-semibold text-ink">{getLocalized(TR.mockTotal, language)}</span>
              <span className="display text-3xl text-ink">{formatPrice(subtotal - discount, language)}</span>
            </div>
            <button
              onClick={onBook}
              aria-hidden
              tabIndex={-1}
              className="mt-6 w-full rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-primary"
            >
              {getLocalized(TR.mockCta, language)}
            </button>
            <p className="mt-3 text-center text-xs text-faint">{getLocalized(TR.mockNote, language)}</p>
          </m.div>
        </m.div>
      </div>
    </section>
  );
}
