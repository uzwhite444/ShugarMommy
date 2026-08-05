import { Leaf, HeartHandshake, BadgePercent, CalendarCheck } from 'lucide-react';
import Reveal from './ui/Reveal';
import { LanguageCode } from '../types';
import { getLocalized } from '../utils';

interface AdvantagesProps {
  language: LanguageCode;
}

const TR = {
  eyebrow: { RU: 'Подход', UZ: 'Yondashuv', EN: 'Approach' },
  title: { RU: 'Почему выбирают нас', UZ: 'Nega aynan biz', EN: 'Why choose us' },
  items: [
    {
      icon: Leaf,
      title: { RU: 'Только натуральное', UZ: 'Faqat tabiiy', EN: 'All natural' },
      text: {
        RU: 'Паста из сахара, воды и лимона — без химии, подходит чувствительной коже.',
        UZ: 'Shakar, suv va limondan pasta — kimyoviy moddasiz, sezgir teriga mos.',
        EN: 'Paste made of sugar, water and lemon — chemical-free, sensitive-skin friendly.',
      },
    },
    {
      icon: HeartHandshake,
      title: { RU: 'Деликатный подход', UZ: 'Nozik yondashuv', EN: 'Delicate care' },
      text: {
        RU: 'Работаем бережно, объясняем каждый шаг и подбираем уход после процедуры.',
        UZ: 'Ehtiyotkor ishlaymiz, har bir qadamni tushuntiramiz, parvarish tanlaymiz.',
        EN: 'Gentle technique, every step explained, aftercare picked for you.',
      },
    },
    {
      icon: BadgePercent,
      title: { RU: 'Выгодные сеты', UZ: 'Foydali setlar', EN: 'Value sets' },
      text: {
        RU: 'Скидка до 15% за несколько зон плюс до 25% у отдельных мастеров — считается автоматически.',
        UZ: 'Bir necha zona uchun 15% gacha va ayrim ustalarda 25% gacha chegirma — avtomatik hisoblanadi.',
        EN: 'Up to 15% off for multiple zones plus up to 25% with selected masters — calculated automatically.',
      },
    },
    {
      icon: CalendarCheck,
      title: { RU: 'Запись за минуту', UZ: 'Bir daqiqada yozilish', EN: 'One-minute booking' },
      text: {
        RU: 'Выберите зоны, мастера и время — заявка сразу придёт администратору в Telegram.',
        UZ: "Zona, usta va vaqtni tanlang — ariza darhol Telegramga boradi.",
        EN: 'Pick zones, master and time — the request lands in our Telegram instantly.',
      },
    },
  ],
};

export default function Advantages({ language }: AdvantagesProps) {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TR.items.map((item, i) => (
            <Reveal key={item.title.EN} delay={i * 0.06}>
              {/* The rule inks along the top edge instead of the card lifting:
                  a 4px lift promises an elevation this system has no shadows
                  for, and it made every control inside a moving target. */}
              <div className="ink-rule rule-top rule-long h-full rounded-xl bg-surface p-7">
                <item.icon size={22} className="text-primary" strokeWidth={1.75} />
                <h3 className="mt-5 text-base font-semibold text-ink">{getLocalized(item.title, language)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{getLocalized(item.text, language)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
