import { Leaf, HeartHandshake, BadgePercent, CalendarCheck } from 'lucide-react';
import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import { MASTERS } from '../data';
import { LanguageCode, Master } from '../types';
import { getLocalized } from '../utils';

interface AdvantagesProps {
  language: LanguageCode;
}

/**
 * The two savings mechanisms, read off the roster rather than typed in — a
 * percentage two masters give, and fixed sets a third one offers. They belong
 * to specific masters, so the card names them: «скидка до N% всем» would be a
 * promise calcTotal() breaks the moment the client picks a master who has none.
 */
const DISCOUNT_RULE = MASTERS.find((master) => master.discount)?.discount ?? null;
const DISCOUNT_MASTERS = DISCOUNT_RULE
  ? MASTERS.filter(
      (master) =>
        master.discount?.pct === DISCOUNT_RULE.pct &&
        master.discount?.minZones === DISCOUNT_RULE.minZones,
    )
  : [];
const SET_MASTERS = MASTERS.filter((master) => (master.sets?.length ?? 0) > 0);

const AND: Record<LanguageCode, string> = { RU: ' и ', UZ: ' va ', EN: ' and ' };

function masterNames(masters: readonly Master[], lang: LanguageCode): string {
  return masters.map((master) => getLocalized(master.name, lang)).join(AND[lang]);
}

/** «−20% от 3 зон у Ангелины и Муслимы. У Ренаты — фиксированные сеты.» */
function valueText(lang: LanguageCode): string {
  const parts: string[] = [];
  if (DISCOUNT_RULE && DISCOUNT_MASTERS.length > 0) {
    const who = masterNames(DISCOUNT_MASTERS, lang);
    const { pct, minZones } = DISCOUNT_RULE;
    parts.push(
      lang === 'UZ'
        ? `${who}da ${minZones} zonadan −${pct}%.`
        : lang === 'EN'
          ? `−${pct}% from ${minZones} zones with ${who}.`
          : `−${pct}% от ${minZones} зон у ${who}.`,
    );
  }
  if (SET_MASTERS.length > 0) {
    const who = masterNames(SET_MASTERS, lang);
    parts.push(
      lang === 'UZ'
        ? `${who}da — belgilangan narxdagi setlar.`
        : lang === 'EN'
          ? `${who} offers fixed-price sets.`
          : `У ${who} — фиксированные сеты.`,
    );
  }
  return parts.join(' ');
}

interface AdvantageCard {
  id: string;
  icon: typeof Leaf;
  title: string;
  text: string;
}

function buildItems(language: LanguageCode): AdvantageCard[] {
  const t = (loc: Record<LanguageCode, string>) => getLocalized(loc, language);
  return [
    {
      id: 'natural',
      icon: Leaf,
      title: t({ RU: 'Только натуральное', UZ: 'Faqat tabiiy', EN: 'All natural' }),
      text: t({
        RU: 'Паста из сахара, воды и лимона — без химии, подходит чувствительной коже.',
        UZ: 'Shakar, suv va limondan pasta — kimyoviy moddasiz, sezgir teriga mos.',
        EN: 'Paste made of sugar, water and lemon — chemical-free, sensitive-skin friendly.',
      }),
    },
    {
      id: 'care',
      icon: HeartHandshake,
      title: t({ RU: 'Деликатный подход', UZ: 'Nozik yondashuv', EN: 'Delicate care' }),
      text: t({
        RU: 'Работаем бережно, объясняем каждый шаг и подбираем уход после процедуры.',
        UZ: 'Ehtiyotkor ishlaymiz, har bir qadamni tushuntiramiz, parvarish tanlaymiz.',
        EN: 'Gentle technique, every step explained, aftercare picked for you.',
      }),
    },
    {
      id: 'value',
      icon: BadgePercent,
      title: t({ RU: 'Выгода за комплекс', UZ: 'Kompleks uchun foyda', EN: 'Combo value' }),
      // Built from the masters' own rules, so this card cannot keep advertising
      // a percentage or a set the booking total no longer applies.
      text: valueText(language),
    },
    {
      id: 'booking',
      icon: CalendarCheck,
      title: t({ RU: 'Запись за минуту', UZ: 'Bir daqiqada yozilish', EN: 'One-minute booking' }),
      text: t({
        RU: 'Выберите зоны, мастера и время — заявка сразу придёт администратору в Telegram.',
        UZ: 'Zona, usta va vaqtni tanlang — ariza darhol Telegramga boradi.',
        EN: 'Pick zones, master and time — the request lands in our Telegram instantly.',
      }),
    },
  ];
}

const TR = {
  eyebrow: { RU: 'Подход', UZ: 'Yondashuv', EN: 'Approach' },
  title: { RU: 'Почему выбирают нас', UZ: 'Nega aynan biz', EN: 'Why choose us' },
};

export default function Advantages({ language }: AdvantagesProps) {
  const items = buildItems(language);

  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow={getLocalized(TR.eyebrow, language)} title={getLocalized(TR.title, language)} />
        {/* Four surfaces arriving in DOM order — `plate`, not `rise`: a card
            carries more mass than a line of type and should land like it. */}
        <Stagger className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={0.12}>
          {items.map((item) => (
            <StaggerItem key={item.id} variant="plate">
              {/* The rule inks along the top edge instead of the card lifting:
                  a 4px lift promises an elevation this system has no shadows
                  for, and it made every control inside a moving target. */}
              <div className="ink-rule rule-top rule-long h-full rounded-xl bg-surface p-7">
                <item.icon size={22} className="text-primary" strokeWidth={1.75} />
                <h3 className="mt-5 text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
