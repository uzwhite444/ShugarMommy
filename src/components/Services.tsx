import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { Check, Share2, Timer } from 'lucide-react';
import Reveal from './ui/Reveal';
import BodyMap from './BodyMap';
import { CATEGORY_LABELS, SERVICE_ZONES } from '../data';
import { LanguageCode, ZoneCategory } from '../types';
import { calcTotal, DISCOUNT_TIERS, formatPrice, getLocalized } from '../utils';

interface ServicesProps {
  language: LanguageCode;
  selectedZoneIds: string[];
  onToggleZone: (zoneId: string) => void;
  onBook: () => void;
}

const TR = {
  eyebrow: { RU: 'Прайс', UZ: 'Narxlar', EN: 'Pricing' },
  title: { RU: 'Услуги и цены', UZ: 'Xizmatlar va narxlar', EN: 'Services & prices' },
  subtitle: {
    RU: 'Отметьте нужные зоны — калькулятор посчитает стоимость и применит скидку за сет. Цены указаны по прайсу топ-мастера: у остальных мастеров дешевле на 25%.',
    UZ: 'Kerakli zonalarni belgilang — kalkulyator narxni hisoblab, set chegirmasini qo‘llaydi. Narxlar top-usta bo‘yicha: boshqa ustalarda 25% arzonroq.',
    EN: 'Tick the zones you need — the calculator totals them and applies the set discount. Prices are the top master’s rate; other masters are 25% lower.',
  },
  popular: { RU: 'Хит', UZ: 'Xit', EN: 'Top' },
  min: { RU: 'мин', UZ: 'daq', EN: 'min' },
  summaryTitle: { RU: 'Ваш комплекс', UZ: 'Sizning kompleksingiz', EN: 'Your combo' },
  empty: {
    RU: 'Зоны пока не выбраны. Отметьте их в списке — и увидите итоговую цену.',
    UZ: 'Zonalar tanlanmagan. Ro‘yxatdan belgilang — yakuniy narxni ko‘rasiz.',
    EN: 'No zones selected yet. Tick them in the list to see your total.',
  },
  subtotal: { RU: 'Сумма', UZ: 'Jami', EN: 'Subtotal' },
  discount: { RU: 'Скидка за сет', UZ: 'Set chegirmasi', EN: 'Set discount' },
  masterHint: {
    RU: 'У Севары и Нилюфар — на 25% дешевле. Выберите мастера при записи.',
    UZ: 'Sevara va Nilufarda 25% arzonroq. Yozilishda ustani tanlang.',
    EN: 'Sevara and Nilufar are 25% cheaper. Pick a master when booking.',
  },
  total: { RU: 'Итого', UZ: 'Yakuniy', EN: 'Total' },
  duration: { RU: 'Время процедуры', UZ: 'Muolaja vaqti', EN: 'Duration' },
  book: { RU: 'Записаться на этот комплекс', UZ: 'Shu kompleksga yozilish', EN: 'Book this combo' },
  bookEmpty: { RU: 'Записаться', UZ: 'Yozilish', EN: 'Book now' },
  tiersHint: {
    RU: `Скидки: от ${DISCOUNT_TIERS[1].minZones} зон — ${DISCOUNT_TIERS[1].pct}%, от ${DISCOUNT_TIERS[0].minZones} зон — ${DISCOUNT_TIERS[0].pct}%`,
    UZ: `Chegirmalar: ${DISCOUNT_TIERS[1].minZones} zonadan — ${DISCOUNT_TIERS[1].pct}%, ${DISCOUNT_TIERS[0].minZones} zonadan — ${DISCOUNT_TIERS[0].pct}%`,
    EN: `Discounts: ${DISCOUNT_TIERS[1].minZones}+ zones — ${DISCOUNT_TIERS[1].pct}%, ${DISCOUNT_TIERS[0].minZones}+ zones — ${DISCOUNT_TIERS[0].pct}%`,
  },
  share: { RU: 'Поделиться комплексом', UZ: "Kompleks bilan bo'lishish", EN: 'Share this combo' },
  shared: { RU: 'Ссылка скопирована!', UZ: 'Havola nusxalandi!', EN: 'Link copied!' },
};

const CATEGORY_ORDER: ZoneCategory[] = ['bikini', 'legs', 'arms', 'face', 'body'];

/** Total that rolls to its new value when zones are toggled. */
function AnimatedPrice({ value, language }: { value: number; language: LanguageCode }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (reduced || from === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    // rAF pauses in hidden/backgrounded tabs — make sure the final value
    // still lands even if the animation frames never fire.
    const settle = setTimeout(() => setDisplay(value), 700);
    return () => {
      controls.stop();
      clearTimeout(settle);
    };
  }, [value, reduced]);

  return <>{formatPrice(display, language)}</>;
}

export default function Services({ language, selectedZoneIds, onToggleZone, onBook }: ServicesProps) {
  const selectedZones = SERVICE_ZONES.filter((z) => selectedZoneIds.includes(z.id));
  const calc = calcTotal(selectedZones);
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?zones=${selectedZoneIds.join(',')}#services`;
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Clipboard blocked — nothing to do, the combo is still on screen.
    }
  };

  return (
    <section id="services" className="bg-soft px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {getLocalized(TR.subtitle, language)}
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
          {/* Zone list — editorial rows with hairlines */}
          <div>
            {/* Interactive body map — tap zones straight on the figure */}
            <Reveal>
              <BodyMap language={language} selectedZoneIds={selectedZoneIds} onToggleZone={onToggleZone} />
            </Reveal>
            {CATEGORY_ORDER.map((category) => {
              const zones = SERVICE_ZONES.filter((z) => z.category === category);
              if (zones.length === 0) return null;
              return (
                <Reveal key={category} className="mb-9 last:mb-0">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-dark">
                    {getLocalized(CATEGORY_LABELS[category], language)}
                  </h3>
                  <ul className="mt-2">
                    {zones.map((zone) => {
                      const selected = selectedZoneIds.includes(zone.id);
                      return (
                        <li key={zone.id} className="border-b border-hairline">
                          <button
                            onClick={() => onToggleZone(zone.id)}
                            aria-pressed={selected}
                            className="group flex w-full items-center justify-between gap-4 py-3.5 text-left transition-colors"
                          >
                            <span className="flex items-center gap-3.5">
                              <span
                                aria-hidden
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                  selected
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-ink/25 bg-transparent group-hover:border-primary'
                                }`}
                              >
                                {selected && <Check size={13} strokeWidth={3} />}
                              </span>
                              <span className={`text-[15px] transition-colors ${selected ? 'font-semibold text-ink' : 'font-medium text-body group-hover:text-ink'}`}>
                                {getLocalized(zone.name, language)}
                                {zone.popular && (
                                  <span className="ml-2.5 rounded-full bg-strong px-2 py-0.5 align-middle text-[11px] font-semibold text-ink/70">
                                    {getLocalized(TR.popular, language)}
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-baseline gap-4 text-sm">
                              <span className="hidden items-center gap-1 text-faint sm:flex">
                                <Timer size={13} /> {zone.durationMin} {getLocalized(TR.min, language)}
                              </span>
                              <span className="font-semibold text-ink">{formatPrice(zone.price, language)}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>
              );
            })}
          </div>

          {/* Sticky calculator — quiet dark receipt */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Reveal>
              <div id="receipt-card" className="rounded-2xl bg-dark p-7 text-ondark sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ondark-soft">
                  {getLocalized(TR.summaryTitle, language)}
                </p>

                {selectedZones.length === 0 ? (
                  <p className="mt-4 text-sm leading-relaxed text-ondark-soft">{getLocalized(TR.empty, language)}</p>
                ) : (
                  <>
                    <ul className="mt-5 border-b border-ondark/15 pb-5">
                      {selectedZones.map((zone) => (
                        <motion.li
                          key={zone.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
                            <span className="text-ondark/85">{getLocalized(zone.name, language)}</span>
                            <span className="font-medium">{formatPrice(zone.price, language)}</span>
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                    <dl className="mt-5 space-y-2.5 text-sm">
                      <div className="flex justify-between text-ondark-soft">
                        <dt>{getLocalized(TR.subtotal, language)}</dt>
                        <dd>{formatPrice(calc.subtotal, language)}</dd>
                      </div>
                      {calc.discountPct > 0 && (
                        <div className="flex justify-between text-champagne">
                          <dt>
                            {getLocalized(TR.discount, language)} −{calc.discountPct}%
                          </dt>
                          <dd>−{formatPrice(calc.discountAmount, language)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between text-ondark-soft">
                        <dt>{getLocalized(TR.duration, language)}</dt>
                        <dd>
                          ≈ {calc.durationMin} {getLocalized(TR.min, language)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between border-t border-ondark/15 pt-4">
                        <dt className="font-semibold">{getLocalized(TR.total, language)}</dt>
                        <dd className="display text-3xl tabular-nums">
                          <AnimatedPrice value={calc.total} language={language} />
                        </dd>
                      </div>
                    </dl>
                  </>
                )}

                <button
                  onClick={onBook}
                  className="btn-press mt-6 w-full rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  {getLocalized(selectedZones.length > 0 ? TR.book : TR.bookEmpty, language)}
                </button>
                {selectedZones.length > 0 && (
                  <button
                    onClick={handleShare}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ondark/20 px-5 py-2.5 text-xs font-semibold text-ondark/80 transition-colors hover:border-ondark/50 hover:text-ondark"
                  >
                    {shared ? <Check size={13} /> : <Share2 size={13} />}
                    {getLocalized(shared ? TR.shared : TR.share, language)}
                  </button>
                )}
                <p className="mt-4 text-center text-xs text-ondark-soft">{getLocalized(TR.tiersHint, language)}</p>
                <p className="mt-1.5 text-center text-xs text-ondark-soft">{getLocalized(TR.masterHint, language)}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
