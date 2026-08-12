import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, m, useReducedMotion } from 'motion/react';
import { Check, Share2 } from 'lucide-react';
import Reveal from './ui/Reveal';
import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import BodyMap from './BodyMap';
import { EASE_INK, STAGGER } from '../lib/motion';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  findZone,
  MASTERS,
  SERVICE_ZONES,
  VISIBLE_SETS,
  zonePriceRange,
} from '../data';
import { LanguageCode, Localized, Master, ServiceSet, ServiceZone, ZoneCategory } from '../types';
import {
  calcTotal,
  formatPrice,
  getLocalized,
  masterInitial,
  PRICE_ON_REQUEST,
  setListPrice,
  zonePriceFor,
} from '../utils';

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
    RU: 'У каждого мастера свой прайс. Выберите мастера — список зон и калькулятор покажут именно её цены.',
    UZ: 'Har bir ustaning o‘z narxi bor. Ustani tanlang — zonalar ro‘yxati va kalkulyator aynan uning narxlarini ko‘rsatadi.',
    EN: 'Every master has her own price list. Pick one — the zones and the calculator switch to her prices.',
  },
  whosePrices: { RU: 'Чей прайс показать', UZ: 'Kimning narxlari', EN: 'Whose prices' },
  anyMaster: { RU: 'Любой мастер', UZ: 'Istalgan usta', EN: 'Any master' },
  anyMasterHint: { RU: 'цены «от»', UZ: '«dan» narxlar', EN: '“from” prices' },
  anyCaption: {
    RU: 'Мастер не выбран — показаны минимальные цены по студии, со знаком «от». Выберите мастера, чтобы увидеть её точный прайс и её скидку.',
    UZ: 'Usta tanlanmagan — studiyaning eng past narxlari «dan» belgisi bilan ko‘rsatilgan. Aniq narx va chegirma uchun ustani tanlang.',
    EN: 'No master picked — these are the studio’s lowest prices, marked “from”. Pick a master to see her exact prices and her discount.',
  },
  pricesOf: { RU: 'Прайс:', UZ: 'Narxlar:', EN: 'Prices:' },
  onlyHerZones: {
    RU: 'показаны только её зоны и её цены.',
    UZ: 'faqat uning zonalari va narxlari ko‘rsatilgan.',
    EN: 'only her zones and her prices are shown.',
  },
  performedBy: { RU: 'Выполняет:', UZ: 'Bajaradi:', EN: 'Performed by:' },
  otherTechniques: { RU: 'Другие техники', UZ: 'Boshqa texnikalar', EN: 'Other techniques' },
  popular: { RU: 'Хит', UZ: 'Xit', EN: 'Top' },

  setsTitle: { RU: 'Выгодные сеты', UZ: 'Foydali setlar', EN: 'Value sets' },
  setsHint: {
    RU: 'Фиксированная цена, которая действует только у указанного мастера. Нажмите на сет — его зоны и мастер подставятся в калькулятор.',
    UZ: 'Belgilangan narx, u faqat ko‘rsatilgan ustada amal qiladi. Setni bosing — uning zonalari va ustasi kalkulyatorga qo‘yiladi.',
    EN: 'A fixed price that holds with the named master only. Tap a set — its zones and its master go into the calculator.',
  },
  setApplied: { RU: 'Выбрано', UZ: 'Tanlandi', EN: 'Selected' },
  setSaving: { RU: 'выгода', UZ: 'foyda', EN: 'you save' },
  setRow: { RU: 'Выгодный сет', UZ: 'Foydali set', EN: 'Value set' },

  summaryTitle: { RU: 'Ваш комплекс', UZ: 'Sizning kompleksingiz', EN: 'Your combo' },
  empty: {
    RU: 'Зоны пока не выбраны. Отметьте их в списке — и увидите итоговую цену.',
    UZ: 'Zonalar tanlanmagan. Ro‘yxatdan belgilang — yakuniy narxni ko‘rasiz.',
    EN: 'No zones selected yet. Tick them in the list to see your total.',
  },
  subtotal: { RU: 'Сумма', UZ: 'Jami', EN: 'Subtotal' },
  discount: { RU: 'Скидка', UZ: 'Chegirma', EN: 'Discount' },
  // Says both halves of the truth on purpose: calcTotal counts the combo tier on
  // priced zones only, so «3 зоны» in the hint below can be on screen while the
  // discount line is not.
  onRequestNote: {
    RU: 'Зоны «по запросу» не входят ни в сумму, ни в скидку — их цену назовёт мастер.',
    UZ: '«So‘rov bo‘yicha» zonalar summaga ham, chegirmaga ham kirmaydi — narxini usta aytadi.',
    EN: '“On request” zones count toward neither the total nor the discount — the master will quote them.',
  },
  notOffered: { RU: 'не делает', UZ: 'bajarmaydi', EN: 'not offered' },
  notOfferedNote: {
    RU: 'Отмеченные зоны этот мастер не делает — они не входят в сумму. Уберите их или выберите другого мастера.',
    UZ: 'Belgilangan zonalarni bu usta bajarmaydi — ular summaga kirmaydi. Ularni olib tashlang yoki boshqa ustani tanlang.',
    EN: 'The flagged zones are not offered by this master — they are out of the total. Remove them or pick another master.',
  },
  removeUnavailable: { RU: 'Убрать эти зоны', UZ: 'Bu zonalarni olib tashlash', EN: 'Remove those zones' },
  total: { RU: 'Итого', UZ: 'Yakuniy', EN: 'Total' },
  book: { RU: 'Записаться на этот комплекс', UZ: 'Shu kompleksga yozilish', EN: 'Book this combo' },
  bookEmpty: { RU: 'Записаться', UZ: 'Yozilish', EN: 'Book now' },
  discountsTitle: { RU: 'Скидки', UZ: 'Chegirmalar', EN: 'Discounts' },
  ruleSetsOnly: {
    RU: 'без процентных скидок, только фиксированные сеты',
    UZ: 'foizli chegirmalarsiz, faqat belgilangan setlar',
    EN: 'no percentage discounts, fixed sets only',
  },
  ruleNone: { RU: 'без скидок', UZ: 'chegirmasiz', EN: 'no discounts' },
  share: { RU: 'Поделиться комплексом', UZ: 'Kompleks bilan bo‘lishish', EN: 'Share this combo' },
  shared: { RU: 'Ссылка скопирована!', UZ: 'Havola nusxalandi!', EN: 'Link copied!' },
};

/**
 * Which categories are sugaring and which are a different technique. A TOTAL
 * record on purpose: adding a ZoneCategory without deciding this is a compile
 * error, not a new service quietly filed under sugaring.
 */
const IS_SUGARING: Readonly<Record<ZoneCategory, boolean>> = {
  face: true,
  arms: true,
  legs: true,
  bikini: true,
  body: true,
  brows: false,
  polymer: false,
};

/** Extra line under the heading of the categories that are NOT sugaring. */
const CATEGORY_NOTES: Partial<Record<ZoneCategory, Localized>> = {
  brows: {
    RU: 'Не шугаринг — отдельные бьюти-услуги.',
    UZ: 'Shugaring emas — alohida go‘zallik xizmatlari.',
    EN: 'Not sugaring — separate beauty services.',
  },
  polymer: {
    RU: 'Другая техника, не шугаринг: цены отличаются от одноимённых зон выше.',
    UZ: 'Boshqa texnika, shugaring emas: narxlar yuqoridagi shu nomli zonalardan farq qiladi.',
    EN: 'A different technique, not sugaring: prices differ from the same-named zones above.',
  },
};

/**
 * Masters who perform at least one zone of a category — derived, never written
 * by hand, so "Выполняет: Рената" cannot outlive the roster it describes.
 */
const CATEGORY_MASTERS = new Map<ZoneCategory, readonly Master[]>(
  CATEGORY_ORDER.map((category) => {
    const ids = SERVICE_ZONES.filter((z) => z.category === category).map((z) => z.id);
    return [category, MASTERS.filter((master) => ids.some((id) => master.zoneIds.includes(id)))];
  }),
);

/**
 * Marks a number as a FLOOR, not a quote. Russian and English take a prefix,
 * Uzbek the ablative suffix on the already-formatted "170 000 so'm".
 */
function withFrom(price: string, lang: LanguageCode): string {
  if (lang === 'UZ') return `${price}dan`;
  return `${lang === 'EN' ? 'from' : 'от'} ${price}`;
}

/** One master's discount rule, worded from her own data. */
function discountRule(master: Master, lang: LanguageCode): string {
  const { discount } = master;
  if (discount) {
    if (lang === 'UZ') return `${discount.minZones} va undan ortiq zonada −${discount.pct}%`;
    if (lang === 'EN') return `−${discount.pct}% on ${discount.minZones} zones or more`;
    return `−${discount.pct}% от ${discount.minZones} зон и больше`;
  }
  return getLocalized(master.sets?.length ? TR.ruleSetsOnly : TR.ruleNone, lang);
}

/** Total that rolls to its new value when zones are toggled. */
function AnimatedPrice({
  value,
  language,
  from,
}: {
  value: number;
  language: LanguageCode;
  /** Print the total as «от …» — see CalcResult.priceVaries. */
  from?: boolean;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const start = prevRef.current;
    prevRef.current = value;
    if (reduced || start === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(start, value, {
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

  const text = formatPrice(display, language);
  return <>{from ? withFrom(text, language) : text}</>;
}

export default function Services({ language, selectedZoneIds, onToggleZone, onBook }: ServicesProps) {
  // Whose price list is on screen. Local to this section on purpose: it decides
  // what the visitor READS here, while the booking modal keeps its own master
  // step as the thing that actually books.
  const [masterId, setMasterId] = useState('');
  // `m` is motion's element factory in this file — never shadow it in a callback.
  const master = MASTERS.find((candidate) => candidate.id === masterId) ?? null;

  const selectedZones = SERVICE_ZONES.filter((z) => selectedZoneIds.includes(z.id));
  const calc = calcTotal(selectedZones, master);
  const hasPriced = calc.pricedZones.length > 0;
  const [shared, setShared] = useState(false);
  const reduced = useReducedMotion();

  // A master's list is exactly her zones — Ангелина must not be shown a brow
  // lamination price she cannot perform.
  const visibleZones = useMemo(
    () => (master ? SERVICE_ZONES.filter((z) => master.zoneIds.includes(z.id)) : SERVICE_ZONES),
    [master],
  );

  const blocks = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        zones: visibleZones.filter((z) => z.category === category),
      })).filter((block) => block.zones.length > 0),
    [visibleZones],
  );
  // Where the sugaring price list ends and the other techniques begin.
  const firstOtherTechnique = blocks.find((block) => !IS_SUGARING[block.category])?.category ?? null;

  // Zones already in the basket that the chosen master does not perform. They
  // are NOT silently dropped — losing a client's selection behind her back is
  // worse than telling her the truth and offering the button.
  const unavailableZones = master ? selectedZones.filter((z) => !master.zoneIds.includes(z.id)) : [];
  const onRequestZones = calc.onRequestZones.filter((z) => !unavailableZones.includes(z));

  /**
   * What this zone costs in the current context. Never a bare number when the
   * masters disagree and none is chosen — that figure is a floor, and printing
   * it plain would misquote the visit the moment Рената is picked.
   */
  // Rows are priced by whoever the total is priced by: with nobody chosen that
  // is the cheapest master covering the whole basket, so 110 000 + 200 000 can
  // never sit above a total of 330 000.
  const priceText = (zone: ServiceZone): string => {
    const price = zonePriceFor(zone, master ?? calc.quotedBy);
    if (price === null) return getLocalized(PRICE_ON_REQUEST, language);
    const text = formatPrice(price, language);
    return !master && zonePriceRange(zone.id).varies ? withFrom(text, language) : text;
  };

  // One line per discount rule actually in force, grouped so masters who share
  // a rule share a line. Built from Master.discount / Master.sets, so it cannot
  // promise a reduction the studio does not give.
  const discountLines = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const candidate of master ? [master] : MASTERS) {
      const rule = discountRule(candidate, language);
      groups.set(rule, [...(groups.get(rule) ?? []), getLocalized(candidate.name, language)]);
    }
    return [...groups].map(([rule, names]) => `${names.join(', ')} — ${rule}`);
  }, [master, language]);

  /**
   * Put exactly this set in the basket. The parent only exposes a toggle, so
   * the selection is diffed rather than replaced — and the set's master is
   * selected with it, because the fixed price only holds with her.
   */
  const applySet = (setMaster: Master, set: ServiceSet) => {
    setMasterId(setMaster.id);
    for (const id of selectedZoneIds) if (!set.zoneIds.includes(id)) onToggleZone(id);
    for (const id of set.zoneIds) if (!selectedZoneIds.includes(id)) onToggleZone(id);
  };

  const handleShare = async () => {
    // Only the zones travel: App reads "?zones=" and nothing else, so a master
    // in the link would be dropped on open and the recipient would be quoted
    // «от» prices under a name that never applied.
    const url = `${window.location.origin}${window.location.pathname}?zones=${selectedZoneIds.join(',')}#services`;
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Clipboard blocked — nothing to do, the combo is still on screen.
    }
  };

  const whosePrices = getLocalized(TR.whosePrices, language);
  const masterName = master ? getLocalized(master.name, language) : null;

  return (
    <section id="services" className="bg-soft px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          split
          eyebrow={getLocalized(TR.eyebrow, language)}
          title={getLocalized(TR.title, language)}
          subtitle={getLocalized(TR.subtitle, language)}
        />

        {/* Whose prices — governs the list, the map and the receipt at once, so
            it sits above all three rather than inside one of them. */}
        <Reveal variant="rise" delay={0.05} className="mt-10">
          <div className="rounded-xl border border-hairline bg-canvas p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{whosePrices}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={whosePrices}>
              <button
                onClick={() => setMasterId('')}
                aria-pressed={master === null}
                className={`btn-press ink-rule rule-chip flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center ${
                  master === null ? 'border-ink bg-ink text-canvas' : 'border-hairline bg-canvas hover:border-muted'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                    master === null ? 'bg-canvas/15 text-canvas' : 'bg-surface text-muted'
                  }`}
                >
                  ✦
                </span>
                <span className="text-[13px] font-semibold leading-tight">
                  {getLocalized(TR.anyMaster, language)}
                </span>
                <span className={`text-[10px] leading-tight ${master === null ? 'text-canvas/60' : 'text-faint'}`}>
                  {getLocalized(TR.anyMasterHint, language)}
                </span>
              </button>
              {MASTERS.map((candidate) => {
                const selected = candidate.id === masterId;
                return (
                  <button
                    key={candidate.id}
                    onClick={() => setMasterId(candidate.id)}
                    aria-pressed={selected}
                    className={`btn-press ink-rule rule-chip flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center ${
                      selected ? 'border-ink bg-ink text-canvas' : 'border-hairline bg-canvas hover:border-muted'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-8 w-8 items-center justify-center rounded-full font-serif text-base font-semibold ${
                        selected ? 'bg-canvas/15 text-canvas' : 'bg-primary-soft text-primary-dark'
                      }`}
                    >
                      {masterInitial(candidate, language)}
                    </span>
                    <span className="text-[13px] font-semibold leading-tight">
                      {getLocalized(candidate.name, language)}
                    </span>
                    <span className={`text-[10px] leading-tight ${selected ? 'text-canvas/60' : 'text-faint'}`}>
                      {getLocalized(candidate.title, language)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              {master
                ? `${getLocalized(TR.pricesOf, language)} ${masterName} — ${getLocalized(TR.onlyHerZones, language)}`
                : getLocalized(TR.anyCaption, language)}
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
          {/* Zone list — editorial rows with hairlines */}
          <div>
            {/* Interactive body map — tap zones straight on the figure.
                DELIBERATELY unwrapped. Any entrance here is an entrance on an
                ancestor of `.body-figure`, whose `mix-blend-mode` renders the
                artwork's cream plate the moment a stacking context appears above
                it — and the figure is light-on-soft, so unlike the paste clip
                that plate is plainly visible mid-fade. The dots below carry the
                section's entrance instead; the figure is simply there. */}
            <BodyMap
              language={language}
              selectedZoneIds={selectedZoneIds}
              onToggleZone={onToggleZone}
              master={master}
              priceLabel={priceText}
            />

            {/* Fixed-price bundles. Shown whoever is picked — a client reading
                Ангелина's list still has to be able to discover them — but each
                card names its own master, and tapping one switches to her. */}
            {VISIBLE_SETS.length > 0 && (
              <Reveal variant="rise" className="mb-11">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                  {getLocalized(TR.setsTitle, language)}
                </h3>
                <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
                  {getLocalized(TR.setsHint, language)}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {VISIBLE_SETS.map(({ master: setMaster, set }) => {
                    const listPrice = setListPrice(set, setMaster);
                    const savings = listPrice - set.price;
                    // Only the set the calculator has actually applied reads as
                    // chosen — the same test calcTotal used for the total.
                    const selected = calc.appliedSet?.id === set.id;
                    return (
                      <button
                        key={set.id}
                        onClick={() => applySet(setMaster, set)}
                        aria-pressed={selected}
                        className={`btn-press ink-rule rule-top flex h-full flex-col rounded-xl border p-4 text-left ${
                          selected ? 'border-primary bg-primary-soft' : 'border-hairline bg-canvas hover:border-muted'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-serif text-sm font-semibold text-primary-dark ${
                              selected ? 'bg-canvas' : 'bg-primary-soft'
                            }`}
                          >
                            {masterInitial(setMaster, language)}
                          </span>
                          <span className="min-w-0 truncate text-xs font-semibold text-ink">
                            {getLocalized(setMaster.name, language)}
                          </span>
                          {selected && (
                            <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary-dark">
                              <Check size={12} strokeWidth={3} />
                              {getLocalized(TR.setApplied, language)}
                            </span>
                          )}
                        </span>
                        {/* One zone per line, not a run-on "A + B + C + D": the
                            official names are long enough that a single joined
                            string wraps into a paragraph at 320px. */}
                        <span className="mt-3 mb-4 block space-y-1">
                          {set.zoneIds.map((id) => {
                            const zone = findZone(id);
                            if (!zone) return null;
                            return (
                              <span key={id} className="block text-[13px] leading-snug text-body">
                                {getLocalized(zone.name, language)}
                              </span>
                            );
                          })}
                        </span>
                        {/* mt-auto pins the price to the bottom, so cards of
                            different composition still line their prices up. */}
                        <span className="mt-auto flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-hairline pt-3">
                          <span className="display text-2xl text-ink">{formatPrice(set.price, language)}</span>
                          <span className="text-xs text-muted line-through">{formatPrice(listPrice, language)}</span>
                          {savings > 0 && (
                            <span className="text-xs font-semibold text-primary-dark">
                              {getLocalized(TR.setSaving, language)} {formatPrice(savings, language)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Reveal>
            )}

            {/* A price list assembles top-down: one tight beat per category
                block, and the rows inside stay still. Twenty individually
                animating price rows would be a slot machine. */}
            <Stagger step={STAGGER.tight}>
              {blocks.map(({ category, zones }) => {
                const categoryMasters = CATEGORY_MASTERS.get(category) ?? [];
                // Only worth saying when the category is NOT studio-wide — and
                // only while no master is chosen, since her own list is already
                // labelled above.
                const exclusive = !master && categoryMasters.length < MASTERS.length;
                const note = CATEGORY_NOTES[category];
                return (
                  <StaggerItem key={category} className="mb-9 last:mb-0">
                    {/* Where sugaring ends. Brows/lashes and polymer are other
                        techniques at other prices, so they get a band of their
                        own instead of trailing the sugaring zones. */}
                    {category === firstOtherTechnique && (
                      <div aria-hidden className="mb-7 flex items-center gap-3">
                        <span className="h-px flex-1 bg-hairline" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          {getLocalized(TR.otherTechniques, language)}
                        </span>
                        <span className="h-px flex-1 bg-hairline" />
                      </div>
                    )}
                    {/* text-ink, not the terracotta accent: primary-dark on bg-soft
                        is 4.31:1, below the 4.5:1 AA bar for this 12px label. */}
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                      {getLocalized(CATEGORY_LABELS[category], language)}
                    </h3>
                    {note && <p className="mt-1.5 text-xs leading-relaxed text-muted">{getLocalized(note, language)}</p>}
                    {exclusive && (
                      <p className="mt-1 text-xs text-faint">
                        {getLocalized(TR.performedBy, language)}{' '}
                        {categoryMasters.map((who) => getLocalized(who.name, language)).join(', ')}
                      </p>
                    )}
                    <ul className="mt-2">
                      {zones.map((zone) => {
                        const selected = selectedZoneIds.includes(zone.id);
                        const price = zonePriceFor(zone, master);
                        return (
                          <li key={zone.id} className="border-b border-hairline">
                            <button
                              onClick={() => onToggleZone(zone.id)}
                              aria-pressed={selected}
                              className="group btn-press ink-rule rule-row rule-long flex w-full items-center justify-between gap-3 py-3.5 text-left sm:gap-4"
                            >
                              {/* min-w-0 all the way down: the official zone names
                                  run to "Голени с захватом колена + пальчики", and
                                  a flex child defaults to min-width:auto — without
                                  this the row refuses to shrink and pushes the
                                  whole page sideways at 320px instead of wrapping. */}
                              <span className="flex min-w-0 flex-1 items-center gap-3 sm:gap-3.5">
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
                                <span className={`min-w-0 text-[15px] transition-colors ${selected ? 'font-semibold text-ink' : 'font-medium text-body group-hover:text-ink'}`}>
                                  {getLocalized(zone.name, language)}
                                  {zone.popular && (
                                    <span className="ml-2.5 rounded-full bg-strong px-2 py-0.5 align-middle text-[11px] font-semibold text-ink/70">
                                      {getLocalized(TR.popular, language)}
                                    </span>
                                  )}
                                </span>
                              </span>
                              {/* A zone the studio has not priced yet reads
                                  «по запросу» — never a number we invented, and
                                  never a 0 that looks like it is free. */}
                              <span
                                className={`shrink-0 text-right text-sm ${
                                  price === null ? 'font-medium text-muted' : 'font-semibold text-ink'
                                }`}
                              >
                                {priceText(zone)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>

          {/* Sticky calculator — quiet dark receipt.
              top-20 = the header's real 64px plus 16px of air. `top-24` was
              pinning the card 96px down for a 64px bar that retracts to 0, so
              the gap above it silently varied with scroll direction. */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Reveal variant="plate" delay={0.1} trigger="far">
              <div id="receipt-card" className="rounded-2xl bg-dark p-7 text-ondark sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ondark-soft">
                  {getLocalized(TR.summaryTitle, language)}
                </p>
                {/* The receipt travels down the page on its own, so it repeats
                    whose prices it is adding up rather than relying on the
                    picker being still on screen. */}
                <p className="mt-1.5 text-xs text-champagne">
                  {master
                    ? `${getLocalized(TR.pricesOf, language)} ${masterName}`
                    : `${getLocalized(TR.anyMaster, language)} · ${getLocalized(TR.anyMasterHint, language)}`}
                </p>

                {selectedZones.length === 0 ? (
                  <p className="mt-4 text-sm leading-relaxed text-ondark-soft">{getLocalized(TR.empty, language)}</p>
                ) : (
                  <>
                    <ul className="mt-5 border-b border-ondark/15 pb-5">
                      {selectedZones.map((zone) => {
                        const unavailable = unavailableZones.includes(zone);
                        return (
                          // `height: 0 -> auto` is a layout animation — it reflows the
                          // whole receipt on every frame, and it is the one thing the
                          // project's own rule ("compositor-friendly properties only")
                          // forbids outright. The row takes its space immediately and
                          // only its ink fades in.
                          <m.li
                            key={zone.id}
                            initial={reduced ? false : { opacity: 0 }}
                            animate={reduced ? undefined : { opacity: 1 }}
                            transition={{ duration: 0.3, ease: EASE_INK }}
                          >
                            <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                              <span className="min-w-0 text-ondark/85">{getLocalized(zone.name, language)}</span>
                              {/* A zone this master does not perform is not "по
                                  запросу" — nobody here will quote it. Saying so
                                  is the only honest label. */}
                              <span
                                className={`shrink-0 text-right ${
                                  unavailable
                                    ? 'text-danger'
                                    : zonePriceFor(zone, master) === null
                                      ? 'text-ondark-soft'
                                      : 'font-medium'
                                }`}
                              >
                                {unavailable ? getLocalized(TR.notOffered, language) : priceText(zone)}
                              </span>
                            </div>
                          </m.li>
                        );
                      })}
                    </ul>
                    <dl className="mt-5 space-y-2.5 text-sm">
                      {/* Subtotal and discount only exist once something priced is
                          in the basket — otherwise they would both read 0 сум. */}
                      {hasPriced && (
                        <>
                          <div className="flex justify-between text-ondark-soft">
                            <dt>{getLocalized(TR.subtotal, language)}</dt>
                            {/* Marked «от» on the same condition as the total:
                                with no master picked the rows above it are all
                                floors, so a bare sum here reads as a firm
                                quote the moment the client scrolls past
                                «Итого» — and Рената's prices are higher. */}
                            <dd>
                              {calc.priceVaries
                                ? withFrom(formatPrice(calc.subtotal, language), language)
                                : formatPrice(calc.subtotal, language)}
                            </dd>
                          </div>
                          {/* A set REPLACES the percentage — never both, or the
                              receipt would show a reduction the studio did not
                              give. calcTotal decides which one applies. */}
                          {calc.appliedSet ? (
                            <div className="flex justify-between text-champagne">
                              <dt>{getLocalized(TR.setRow, language)}</dt>
                              <dd>−{formatPrice(calc.setSavings, language)}</dd>
                            </div>
                          ) : (
                            calc.discountPct > 0 && (
                              <div className="flex justify-between text-champagne">
                                <dt>
                                  {getLocalized(TR.discount, language)} −{calc.discountPct}%
                                </dt>
                                <dd>−{formatPrice(calc.discountAmount, language)}</dd>
                              </div>
                            )
                          )}
                        </>
                      )}
                      <div className="flex items-baseline justify-between gap-3 border-t border-ondark/15 pt-4">
                        <dt className="font-semibold">{getLocalized(TR.total, language)}</dt>
                        {/* A basket of nothing but unpriced zones has no total to
                            show: printing 0 сум would quote a price the studio
                            never gave. */}
                        <dd
                          className={
                            hasPriced ? 'display text-3xl tabular-nums' : 'text-right text-base font-semibold'
                          }
                        >
                          {hasPriced ? (
                            <AnimatedPrice value={calc.total} language={language} from={calc.priceVaries} />
                          ) : (
                            getLocalized(PRICE_ON_REQUEST, language)
                          )}
                        </dd>
                      </div>
                    </dl>
                    {onRequestZones.length > 0 && (
                      <p className="mt-3.5 text-xs leading-relaxed text-champagne">
                        {getLocalized(TR.onRequestNote, language)}
                      </p>
                    )}
                    {unavailableZones.length > 0 && (
                      <div className="mt-3.5">
                        <p className="text-xs leading-relaxed text-danger">
                          {getLocalized(TR.notOfferedNote, language)}
                        </p>
                        <button
                          onClick={() => unavailableZones.forEach((zone) => onToggleZone(zone.id))}
                          className="btn-press ink-rule rule-link rule-tight mt-2 min-h-11 text-xs font-semibold text-ondark"
                        >
                          {getLocalized(TR.removeUnavailable, language)}
                        </button>
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={onBook}
                  className="btn-press press-slab mt-6 w-full rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  {getLocalized(selectedZones.length > 0 ? TR.book : TR.bookEmpty, language)}
                </button>
                {selectedZones.length > 0 && (
                  <button
                    onClick={handleShare}
                    className="btn-press ink-rule rule-slab rule-on-dark mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-ondark/20 px-5 text-xs font-semibold text-ondark/80 hover:border-ondark/50 hover:text-ondark"
                  >
                    {shared ? <Check size={13} /> : <Share2 size={13} />}
                    {getLocalized(shared ? TR.shared : TR.share, language)}
                  </button>
                )}
                {/* The discount rule belongs to the MASTER, so this says whose it
                    is. With nobody picked it lists every rule in force instead of
                    promising one of them. */}
                <div className="mt-5 border-t border-ondark/15 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ondark-soft">
                    {getLocalized(TR.discountsTitle, language)}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {discountLines.map((line) => (
                      <li key={line} className="text-xs leading-relaxed text-ondark-soft">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
