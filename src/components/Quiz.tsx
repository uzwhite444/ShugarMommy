import { useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Sparkles, Check, RotateCcw } from 'lucide-react';
import Reveal from './ui/Reveal';
import SectionHead from './ui/SectionHead';
import { LanguageCode, Localized } from '../types';
import { SERVICE_ZONES, zonePriceRange } from '../data';
import {
  calcTotal,
  formatPrice,
  formatZonePrice,
  getLocalized,
  PRICE_ON_REQUEST,
  priceFrom,
} from '../utils';

interface QuizProps {
  language: LanguageCode;
  /** Applies the recommended zones to the main calculator selection. */
  onApplyZones: (zoneIds: string[]) => void;
  onBook: () => void;
}

interface AreaOption {
  /** Zone id from the price list — the quiz selection IS a zone selection. */
  zoneId: string;
  /**
   * Studio wording with the "+ кисти, пальчики" qualifier dropped, so the chip
   * row stays scannable. The full official name is what the result list prints.
   */
  label: Localized;
}

/**
 * The zones asked about first. Non-overlapping on purpose: offering both "Ноги
 * полностью" and "Голени" would let a client pick two zones that contain each
 * other and read a doubled total.
 */
const AREA_DEFS: readonly AreaOption[] = [
  { zoneId: 'bikini-deep', label: { RU: 'Глубокое бикини', UZ: 'Chuqur bikini', EN: 'Deep bikini' } },
  { zoneId: 'legs-full', label: { RU: 'Ноги полностью', UZ: 'Oyoqlar to‘liq', EN: 'Full legs' } },
  { zoneId: 'underarms', label: { RU: 'Подмышечные впадины', UZ: 'Qo‘ltiq osti', EN: 'Underarms' } },
  { zoneId: 'arms-full', label: { RU: 'Руки полностью', UZ: 'Qo‘llar to‘liq', EN: 'Full arms' } },
  { zoneId: 'belly', label: { RU: 'Живот', UZ: 'Qorin', EN: 'Belly' } },
  { zoneId: 'back', label: { RU: 'Спина', UZ: 'Orqa', EN: 'Back' } },
];

/**
 * Drop any chip whose zone is not published: SERVICE_ZONES already excludes the
 * hidden face zones, so a chip can never offer something the price list does
 * not carry (which is exactly how "Лицо" used to leak in here).
 */
const AREAS: readonly AreaOption[] = AREA_DEFS.filter((area) =>
  SERVICE_ZONES.some((zone) => zone.id === area.zoneId),
);

type Method = 'razor' | 'wax' | 'sugaring' | 'none';
type Skin = 'normal' | 'sensitive';

const TR = {
  eyebrow: { RU: 'Мини-квиз', UZ: 'Mini-viktorina', EN: 'Mini quiz' },
  title: { RU: 'Персональный план гладкости', UZ: 'Shaxsiy silliqlik rejasi', EN: 'Your personal smoothness plan' },
  subtitle: {
    RU: 'Три вопроса — и мы соберём комплекс под вас, с ценой и советами перед визитом.',
    UZ: 'Uch savol — sizga mos kompleksni narx va maslahatlar bilan yig‘amiz.',
    EN: 'Three questions — we build your combo with a price and pre-visit tips.',
  },
  q1: { RU: 'Какие зоны вас интересуют?', UZ: 'Qaysi zonalar qiziqtiradi?', EN: 'Which areas interest you?' },
  q1hint: { RU: 'Можно выбрать несколько', UZ: 'Bir nechtasini tanlash mumkin', EN: 'Pick as many as you like' },
  q2: { RU: 'Как вы удаляете волосы сейчас?', UZ: 'Hozir tuklarni qanday olasiz?', EN: 'How do you remove hair now?' },
  q2opts: {
    razor: { RU: 'Бритва', UZ: 'Ustara', EN: 'Razor' },
    wax: { RU: 'Воск', UZ: 'Mum', EN: 'Wax' },
    sugaring: { RU: 'Шугаринг', UZ: 'Shugaring', EN: 'Sugaring' },
    none: { RU: 'Никак', UZ: 'Olmayman', EN: "I don't" },
  } as Record<Method, Localized>,
  q3: { RU: 'Какая у вас кожа?', UZ: 'Teringiz qanday?', EN: 'How is your skin?' },
  q3opts: {
    normal: { RU: 'Обычная', UZ: 'Oddiy', EN: 'Normal' },
    sensitive: { RU: 'Чувствительная', UZ: 'Sezgir', EN: 'Sensitive' },
  } as Record<Skin, Localized>,
  next: { RU: 'Дальше', UZ: 'Keyingi', EN: 'Next' },
  back: { RU: 'Назад', UZ: 'Orqaga', EN: 'Back' },
  resultTitle: { RU: 'Ваш план готов', UZ: 'Rejangiz tayyor', EN: 'Your plan is ready' },
  yourCombo: { RU: 'Рекомендуемый комплекс', UZ: 'Tavsiya etilgan kompleks', EN: 'Recommended combo' },
  perVisit: { RU: 'за визит', UZ: 'har tashrif uchun', EN: 'per visit' },
  /**
   * The quiz asks no master, and price, discount and sets all depend on her —
   * so the number here is the lowest one the studio charges and is labelled as
   * such. Promising a percentage would be promising Ангелина's and Муслимы's
   * offer for a visit the client may well book with Ренатой, who has none.
   */
  masterNote: {
    RU: 'Цена зависит от мастера — показываем минимальную. Точный итог, скидки и выгодные сеты посчитаем на шаге записи.',
    UZ: 'Narx ustaga bog‘liq — eng past narxni ko‘rsatamiz. Aniq summa, chegirma va foydali setlarni yozilish bosqichida hisoblaymiz.',
    EN: 'The price depends on the master — this is the lowest one. The exact total, discounts and value sets are calculated at the booking step.',
  },
  onRequestNote: {
    RU: 'Зоны с ценой «по запросу» в сумму не входят — стоимость назовём при записи.',
    UZ: '«So‘rov bo‘yicha» zonalar summaga kirmaydi — narxni yozilish paytida aytamiz.',
    EN: 'Zones priced on request are not in the total — we will confirm them when you book.',
  },
  tips: { RU: 'Советы перед визитом', UZ: 'Tashrifdan oldin maslahatlar', EN: 'Tips before your visit' },
  tipMethod: {
    razor: {
      RU: 'После бритвы отрастите волоски 2–3 недели — оптимальная длина от 8 мм до 1 см.',
      UZ: 'Ustaradan keyin tuklarni 2–3 hafta o‘stiring — eng maqbul uzunlik 8 mmdan 1 smgacha.',
      EN: 'After a razor, let hair grow 2–3 weeks — the ideal length is 8 mm to 1 cm.',
    },
    wax: {
      RU: 'После воска шугаринг переносится легче: паста тянет только волоски, а не кожу.',
      UZ: 'Mumdan keyin shugaring yengilroq: pasta faqat tuklarni oladi, terini emas.',
      EN: 'After wax, sugaring feels gentler: the paste grips hair, not skin.',
    },
    sugaring: {
      RU: 'Вы уже с нами! Поддерживающие визиты раз в 2–3 недели сохранят идеальный результат.',
      UZ: 'Siz allaqachon bizdasiz! Har 2–3 haftada tashrif buyursangiz, natija mukammal saqlanadi.',
      EN: 'Already sugaring! Maintenance visits every 2–3 weeks keep the result perfect.',
    },
    none: {
      RU: 'Отлично — длина волосков наверняка уже подходит, можно записываться сразу.',
      UZ: 'Ajoyib — tuk uzunligi allaqachon mos, darhol yozilish mumkin.',
      EN: 'Great — the hair length is likely already perfect, you can book right away.',
    },
  } as Record<Method, Localized>,
  tipSkin: {
    normal: {
      RU: 'Классическая мануальная техника подойдёт идеально.',
      UZ: 'Klassik manual texnika juda mos keladi.',
      EN: 'The classic manual technique will suit you perfectly.',
    },
    sensitive: {
      RU: 'Предупредим мастера: возьмём плотную пасту и успокаивающий уход после.',
      UZ: 'Ustani ogohlantiramiz: zich pasta va tinchlantiruvchi parvarish olamiz.',
      EN: 'We will brief the master: dense paste and a soothing aftercare.',
    },
  } as Record<Skin, Localized>,
  ctaBook: { RU: 'Записаться с этим планом', UZ: 'Shu reja bilan yozilish', EN: 'Book with this plan' },
  restart: { RU: 'Пройти заново', UZ: 'Qayta boshlash', EN: 'Start over' },
  errAreas: { RU: 'Выберите хотя бы одну зону', UZ: 'Kamida bitta zonani tanlang', EN: 'Pick at least one area' },
};

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Quiz({ language, onApplyZones, onBook }: QuizProps) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [areas, setAreas] = useState<string[]>([]);
  const [method, setMethod] = useState<Method | null>(null);
  const [skin, setSkin] = useState<Skin | null>(null);
  const [error, setError] = useState('');

  const t = (loc: Localized) => getLocalized(loc, language);

  // Price-list order, not click order, so the combo reads like the price list.
  const zones = SERVICE_ZONES.filter((z) => areas.includes(z.id));
  // No master is chosen in the quiz, so this is the lowest price across the
  // masters — a floor, and `calc.priceVaries` says when it has to read «от».
  const calc = calcTotal(zones);
  /**
   * With nothing priced the total is a legitimate 0, which would read as "free".
   * Say «по запросу» instead.
   */
  const totalLabel =
    calc.pricedZones.length === 0
      ? t(PRICE_ON_REQUEST)
      : calc.priceVaries
        ? priceFrom(calc.total, language)
        : formatPrice(calc.total, language);

  const toggleArea = (zoneId: string) => {
    setError('');
    setAreas((prev) => (prev.includes(zoneId) ? prev.filter((z) => z !== zoneId) : [...prev, zoneId]));
  };

  const goNext = () => {
    if (step === 0 && areas.length === 0) {
      setError(t(TR.errAreas));
      return;
    }
    setStep((s) => s + 1);
  };

  const restart = () => {
    setStep(0);
    setAreas([]);
    setMethod(null);
    setSkin(null);
    setError('');
  };

  const handleBook = () => {
    onApplyZones(areas);
    onBook();
  };

  const chipCls = (selected: boolean) =>
    `btn-press ink-rule rule-chip rule-short rounded-lg border px-5 py-3 text-sm font-semibold ${
      selected ? 'border-ink bg-ink text-canvas' : 'border-hairline bg-canvas text-body hover:border-muted'
    }`;

  const stepVariants = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, x: 24 },
    animate: reduced ? { opacity: 1 } : { opacity: 1, x: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, x: -24 },
  };

  return (
    <section id="quiz" className="bg-soft px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHead align="center" eyebrow={t(TR.eyebrow)} title={t(TR.title)} subtitle={t(TR.subtitle)} />

        {/* One card, one surface: `plate` and a `far` trigger, so the quiz does
            not start arriving while it is a sliver at the bottom of the fold. */}
        <Reveal variant="plate" trigger="far" delay={0.12}>
          <div className="mt-10 overflow-hidden rounded-2xl bg-canvas p-6 sm:p-9">
            {/* Progress hairlines: each track inks in rather than swapping
                colour — a rule, not a pill. */}
            <div className="mb-7 flex items-center gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-px flex-1 bg-hairline">
                  <span
                    className="quiz-rule block h-px w-full bg-primary"
                    style={{ transform: `scaleX(${step > i ? 1 : step === i ? 0.5 : 0})` }}
                  />
                </span>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {step === 0 && (
                <m.div key="q1" {...stepVariants} transition={{ duration: 0.35, ease: EASE }}>
                  <h3 className="font-serif text-2xl font-semibold text-ink">{t(TR.q1)}</h3>
                  <p className="mt-1 text-xs text-faint">{t(TR.q1hint)}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {AREAS.map((area) => (
                      <button
                        key={area.zoneId}
                        onClick={() => toggleArea(area.zoneId)}
                        aria-pressed={areas.includes(area.zoneId)}
                        className={chipCls(areas.includes(area.zoneId))}
                      >
                        {t(area.label)}
                      </button>
                    ))}
                  </div>
                  {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-danger">
                  {error}
                </p>
              )}
                  <div className="mt-7 flex justify-end">
                    {/* Hover must keep an inverting surface: `ink` and `body` both
                        flip with the theme, so the canvas label stays readable in
                        each. Terracotta here was 3.3:1 light / 2.3:1 dark. */}
                    <button
                      onClick={goNext}
                      className="btn-press press-slab press-nudge flex items-center gap-2 rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-canvas hover:bg-body"
                    >
                      {t(TR.next)} <ArrowRight size={15} className="nudge-icon" />
                    </button>
                  </div>
                </m.div>
              )}

              {step === 1 && (
                <m.div key="q2" {...stepVariants} transition={{ duration: 0.35, ease: EASE }}>
                  <h3 className="font-serif text-2xl font-semibold text-ink">{t(TR.q2)}</h3>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {(Object.keys(TR.q2opts) as Method[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMethod(m);
                          setStep(2);
                        }}
                        aria-pressed={method === m}
                        className={chipCls(method === m)}
                      >
                        {t(TR.q2opts[m])}
                      </button>
                    ))}
                  </div>
                  <div className="mt-7 flex justify-start">
                    <button onClick={() => setStep(0)} className="btn-press ink-rule rule-link rule-short flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
                      <ArrowLeft size={15} /> {t(TR.back)}
                    </button>
                  </div>
                </m.div>
              )}

              {step === 2 && (
                <m.div key="q3" {...stepVariants} transition={{ duration: 0.35, ease: EASE }}>
                  <h3 className="font-serif text-2xl font-semibold text-ink">{t(TR.q3)}</h3>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {(Object.keys(TR.q3opts) as Skin[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSkin(s);
                          setStep(3);
                        }}
                        aria-pressed={skin === s}
                        className={chipCls(skin === s)}
                      >
                        {t(TR.q3opts[s])}
                      </button>
                    ))}
                  </div>
                  <div className="mt-7 flex justify-start">
                    <button onClick={() => setStep(1)} className="btn-press ink-rule rule-link rule-short flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
                      <ArrowLeft size={15} /> {t(TR.back)}
                    </button>
                  </div>
                </m.div>
              )}

              {step === 3 && (
                <m.div key="result" {...stepVariants} transition={{ duration: 0.4, ease: EASE }}>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-dark">
                    <Sparkles size={14} /> {t(TR.resultTitle)}
                  </p>

                  <div className="mt-5 rounded-xl bg-surface p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(TR.yourCombo)}</p>
                    <ul className="mt-3 space-y-2">
                      {zones.map((zone) => (
                        <li key={zone.id} className="flex items-baseline justify-between gap-4 text-sm text-body">
                          <span>{getLocalized(zone.name, language)}</span>
                          {/* Every masters' price list is her own: a zone that
                              costs 110 000 with Ангелиной is 130 000 with
                              Ренатой, so a bare number here would be a quote the
                              studio cannot honour. */}
                          <span className="shrink-0 font-medium text-ink">
                            {zone.price !== null && zonePriceRange(zone.id).varies
                              ? priceFrom(zone.price, language)
                              : formatZonePrice(zone.price, language)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink/10 pt-4">
                      <span className="text-sm text-muted">{t(TR.perVisit)}</span>
                      <span className="display shrink-0 text-3xl text-ink">{totalLabel}</span>
                    </div>
                    {calc.priceVaries && (
                      <p className="mt-3 text-xs leading-relaxed text-muted">{t(TR.masterNote)}</p>
                    )}
                    {calc.onRequestZones.length > 0 && (
                      <p className="mt-3 text-xs leading-relaxed text-muted">{t(TR.onRequestNote)}</p>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(TR.tips)}</p>
                    <ul className="mt-3 space-y-2.5">
                      {method && (
                        <li className="flex items-start gap-2.5 text-sm leading-relaxed text-body">
                          <Check size={15} className="mt-0.5 shrink-0 text-primary" /> {t(TR.tipMethod[method])}
                        </li>
                      )}
                      {skin && (
                        <li className="flex items-start gap-2.5 text-sm leading-relaxed text-body">
                          <Check size={15} className="mt-0.5 shrink-0 text-primary" /> {t(TR.tipSkin[skin])}
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <button onClick={restart} className="btn-press ink-rule rule-link rule-short flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
                      <RotateCcw size={14} /> {t(TR.restart)}
                    </button>
                    <button onClick={handleBook} className="btn-press press-slab rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark">
                      {t(TR.ctaBook)}
                    </button>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
