import { Gift, Tags } from 'lucide-react';
import Reveal from './ui/Reveal';
import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import { STAGGER } from '../lib/motion';
import { MASTERS, VISIBLE_SETS } from '../data';
import { LanguageCode, Master } from '../types';
import { formatPrice, getLocalized, MANAGER_TELEGRAM, setListPrice } from '../utils';

interface PromosProps {
  language: LanguageCode;
  onBook: () => void;
}

/**
 * Only offers the booking total can actually honour live here. Two of them, and
 * they belong to DIFFERENT masters:
 *
 * - a percentage off a multi-zone visit, which Ангелина and Муслима give;
 * - fixed-price sets, which only Рената offers.
 *
 * Neither is a studio-wide promise, so both cards name their masters — a card
 * saying «−20% всем» would be contradicted by calcTotal() the moment the client
 * picks Рената, who gives no percentage at all. The «−20% на первый визит» card
 * that used to lead this section stays deleted: the studio never quoted it.
 */

/**
 * The combo rule and exactly the masters who give it, read off the roster. Two
 * masters share one rule today; taking the rule from the data (rather than
 * typing 20 and 3 here) is what keeps the promo and the calculator in step.
 */
const DISCOUNT_RULE = MASTERS.find((master) => master.discount)?.discount ?? null;
const DISCOUNT_MASTERS = DISCOUNT_RULE
  ? MASTERS.filter(
      (master) =>
        master.discount?.pct === DISCOUNT_RULE.pct &&
        master.discount?.minZones === DISCOUNT_RULE.minZones,
    )
  : [];

/** Masters who offer at least one set, in roster order. */
const SET_MASTERS = MASTERS.filter((master) => (master.sets?.length ?? 0) > 0);
const SET_LOW = Math.min(...VISIBLE_SETS.map(({ set }) => set.price));
/** Best "было − стало" across the sets — the honest headline saving. */
const SET_BEST_SAVING = Math.max(
  0,
  ...VISIBLE_SETS.map(({ master, set }) => setListPrice(set, master) - set.price),
);

const AND: Record<LanguageCode, string> = { RU: ' и ', UZ: ' va ', EN: ' and ' };

function masterNames(masters: readonly Master[], lang: LanguageCode): string {
  return masters.map((master) => getLocalized(master.name, lang)).join(AND[lang]);
}

const TR = {
  eyebrow: { RU: 'Акции', UZ: 'Aksiyalar', EN: 'Offers' },
  title: { RU: 'Сейчас выгодно', UZ: 'Ayni damda foydali', EN: 'Good time to book' },
  combo: {
    title: { RU: 'Комплекс зон', UZ: 'Zonalar kompleksi', EN: 'Zone combo' },
    cta: { RU: 'Собрать комплекс', UZ: 'Kompleks yig‘ish', EN: 'Build a combo' },
  },
  sets: {
    title: { RU: 'Выгодные сеты', UZ: 'Foydali setlar', EN: 'Value sets' },
    cta: { RU: 'Записаться', UZ: 'Yozilish', EN: 'Book a visit' },
  },
  gift: {
    title: { RU: 'Подарочный сертификат', UZ: 'Sovg‘a sertifikati', EN: 'Gift certificate' },
    text: {
      RU: 'Любой номинал, красивое оформление — подарите гладкость близкому человеку.',
      UZ: 'Istalgan qiymat, chiroyli bezatish — yaqiningizga silliqlik sovg‘a qiling.',
      EN: 'Any amount, beautifully presented — give smoothness to someone you love.',
    },
    cta: { RU: 'Оформить в Telegram', UZ: 'Telegramda rasmiylashtirish', EN: 'Arrange on Telegram' },
  },
  // Mirrors calcTotal() exactly: a set replaces the percentage instead of
  // stacking with it, and a zone quoted «по запросу» is in neither number.
  note: {
    RU: 'Скидка и сеты не суммируются: если набор зон совпадает с сетом, действует цена сета. Зоны с ценой «по запросу» в расчёт не входят.',
    UZ: 'Chegirma va setlar qo‘shilmaydi: tanlangan zonalar setga to‘g‘ri kelsa, set narxi amal qiladi. Narxi «so‘rov bo‘yicha» zonalar hisobga kirmaydi.',
    EN: 'The discount and the sets do not stack: a selection matching a set is charged at the set price. Zones priced on request are not part of the total.',
  },
};

/** «Выберите 3 зоны и больше — скидка применится автоматически при записи.» */
function comboText(minZones: number, lang: LanguageCode): string {
  if (lang === 'UZ')
    return `Kalkulyatorda ${minZones} va undan ko‘p zonani tanlang — chegirma yozilishda avtomatik qo‘llanadi.`;
  if (lang === 'EN')
    return `Pick ${minZones} zones or more in the calculator — the discount is applied automatically at booking.`;
  return `Выберите ${minZones} зоны и больше в калькуляторе — скидка применится автоматически при записи.`;
}

/**
 * «Готовые наборы зон по фиксированной цене — от 180 000 сум. Выгода до 30 000
 * сум против отдельных зон. Выполняет: Рената.»
 *
 * The saving is computed against the master's OWN per-zone prices
 * (setListPrice), not against the cheapest master's — comparing her set to
 * another master's zones would invent a discount nobody offers.
 *
 * The master is named after a colon rather than inside the sentence, because
 * `names` comes straight from the roster in the nominative: «Только у Рената»
 * needs the genitive «Ренаты», and declining a name in code would mean
 * inventing a form for every master the studio ever hires. The colon takes the
 * nominative as-is and stays correct for one name or several.
 */
function setsText(names: string, lang: LanguageCode): string {
  const low = formatPrice(SET_LOW, lang);
  const saving = formatPrice(SET_BEST_SAVING, lang);
  if (lang === 'UZ')
    // -dan / -gacha are case suffixes: attached, never spaced off the number.
    return `Belgilangan narxdagi tayyor zona to‘plamlari — ${low}dan boshlab. Alohida zonalarga nisbatan ${saving}gacha foyda. Bajaradi: ${names}.`;
  if (lang === 'EN')
    return `Ready-made zone bundles at a fixed price — from ${low}. Up to ${saving} cheaper than the zones separately. Performed by: ${names}.`;
  return `Готовые наборы зон по фиксированной цене — от ${low}. Выгода до ${saving} против отдельных зон. Выполняет: ${names}.`;
}

export default function Promos({ language, onBook }: PromosProps) {
  const hasSets = VISIBLE_SETS.length > 0 && SET_MASTERS.length > 0;

  return (
    <section id="promos" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow={getLocalized(TR.eyebrow, language)} title={getLocalized(TR.title, language)} />

        {/* Two offers, two columns — the pair splits the row evenly instead of
            leaving a dead cell. The loud card lands first and the quiet one
            follows it, so the two-across row and the stacked phone layout read
            the same way round. */}
        <Stagger className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2" step={STAGGER.loose} delay={0.12}>
          {DISCOUNT_RULE && DISCOUNT_MASTERS.length > 0 && (
            /* Terracotta callout — the one loud card on the page */
            <StaggerItem variant="plate">
              {/* rule-on-primary: a terracotta rule on a terracotta card is
                  invisible, so this one card inks in white. */}
              <div className="ink-rule rule-top rule-on-primary rule-long flex h-full flex-col rounded-xl bg-primary p-8 text-white">
                {/* The badge carries the masters, not a «всем клиенткам» claim:
                    Рената gives no percentage, so naming them is the difference
                    between a promo and a promise the total cannot keep. */}
                {/* Outlined, not filled: `bg-white/15` lifted the terracotta
                    under the label to #B6785C and dropped the white 12px text
                    to 3.61:1 (measured), below the 4.5:1 the rest of the card
                    already meets. An outline leaves the text on the card's own
                    corrected background, and `current` keeps it right in both
                    themes — night mode flips this card to dark ink. */}
                <span className="self-start rounded-full border border-current/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
                  {masterNames(DISCOUNT_MASTERS, language)}
                </span>
                <p className="display mt-6 text-5xl sm:text-6xl">−{DISCOUNT_RULE.pct}%</p>
                <h3 className="mt-3 text-lg font-semibold">{getLocalized(TR.combo.title, language)}</h3>
                {/* No colour utility here on purpose: the paragraph inherits the
                    card's ink, which night mode corrects to dark. An explicit
                    text-white/85 bypasses that correction and drops to 2.2:1. */}
                <p className="mt-2 flex-1 text-sm leading-relaxed">
                  {comboText(DISCOUNT_RULE.minZones, language)}
                </p>
                {/* The card stays light-on-terracotta in both themes, so this
                    always-white button needs tones pinned outside the theme swap. */}
                <button
                  onClick={onBook}
                  className="btn-press press-slab mt-6 flex min-h-11 items-center self-start rounded-lg bg-white px-5 text-sm font-semibold text-onwhite hover:bg-white-soft"
                >
                  {getLocalized(TR.combo.cta, language)}
                </button>
              </div>
            </StaggerItem>
          )}

          {hasSets && (
            <StaggerItem variant="plate">
              <div className="ink-rule rule-top rule-long flex h-full flex-col rounded-xl bg-surface p-8">
                <Tags size={36} className="text-primary" strokeWidth={1.5} />
                <h3 className="mt-6 text-lg font-semibold text-ink">{getLocalized(TR.sets.title, language)}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {setsText(masterNames(SET_MASTERS, language), language)}
                </p>
                <button
                  onClick={onBook}
                  className="btn-press ink-rule rule-slab mt-6 flex min-h-11 items-center self-start rounded-lg border border-ink/20 px-5 text-sm font-semibold text-ink hover:border-ink"
                >
                  {getLocalized(TR.sets.cta, language)}
                </button>
              </div>
            </StaggerItem>
          )}
        </Stagger>

        {/* The certificate is an enquiry, not a quote — it carries no price the
            calculator has to agree with, so it sits below the two priced offers
            as a strip rather than competing with them for a column. */}
        <Reveal variant="plate">
          <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-xl border border-hairline p-6 sm:flex-row sm:items-center sm:p-7">
            <div className="flex items-start gap-4">
              <Gift size={22} className="mt-0.5 shrink-0 text-primary" strokeWidth={1.75} />
              <div>
                <p className="font-semibold text-ink">{getLocalized(TR.gift.title, language)}</p>
                <p className="mt-1 text-sm text-muted">{getLocalized(TR.gift.text, language)}</p>
              </div>
            </div>
            <a
              href={`https://t.me/${MANAGER_TELEGRAM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press ink-rule rule-slab flex min-h-11 shrink-0 items-center rounded-lg border border-ink/20 px-5 text-sm font-semibold text-ink hover:border-ink"
            >
              {getLocalized(TR.gift.cta, language)}
            </a>
          </div>
        </Reveal>

        <p className="mt-6 text-xs text-faint">{getLocalized(TR.note, language)}</p>
      </div>
    </section>
  );
}
