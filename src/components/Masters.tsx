import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import { STAGGER } from '../lib/motion';
import { MASTERS } from '../data';
import { LanguageCode } from '../types';
import { getLocalized } from '../utils';

interface MastersProps {
  language: LanguageCode;
}

const TR = {
  eyebrow: { RU: 'Команда', UZ: 'Jamoa', EN: 'The team' },
  title: { RU: 'Наши мастера', UZ: 'Bizning ustalar', EN: 'Our masters' },
  subtitle: {
    RU: 'Сертифицированные специалисты с медицинским подходом к каждой процедуре. У каждого мастера свои цены — выбирайте при записи.',
    UZ: 'Har bir muolajaga tibbiy yondashuvga ega sertifikatlangan mutaxassislar. Har bir ustaning o‘z narxi bor — yozilishda tanlang.',
    EN: 'Certified specialists with a medical-grade approach. Each master has their own rate — pick one when booking.',
  },
  basePrice: { RU: 'Цены по прайсу', UZ: 'Narxlar prays bo‘yicha', EN: 'Standard price list' },
  discount: { RU: 'к прайсу', UZ: 'praysga', EN: 'off the price list' },
};

/** "5 лет опыта" / "3 года опыта" — правильная русская плюрализация. */
function experienceLabel(years: number, language: LanguageCode): string {
  if (language === 'UZ') return `${years} yil tajriba`;
  if (language === 'EN') return `${years} yrs experience`;
  const mod10 = years % 10;
  const mod100 = years % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'год'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'года'
        : 'лет';
  return `${years} ${word} опыта`;
}

export default function Masters({ language }: MastersProps) {
  return (
    <section id="masters" className="bg-soft px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow={getLocalized(TR.eyebrow, language)}
          title={getLocalized(TR.title, language)}
          subtitle={getLocalized(TR.subtitle, language)}
        />
        {/* Three people, introduced one at a time — the loosest stagger on the
            page (100ms) so each name gets its own beat instead of the grid
            arriving as a block. */}
        <Stagger
          className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          step={STAGGER.loose}
          delay={0.12}
        >
          {MASTERS.map((master) => (
            <StaggerItem key={master.id} variant="plate">
              <article className="h-full rounded-xl bg-canvas p-7">
                {/* Avatar placeholder — заменяется на фото мастера. */}
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft font-serif text-2xl font-semibold text-primary-dark">
                  {master.initials}
                </div>
                <h3 className="display mt-5 text-2xl text-ink">
                  {getLocalized(master.name, language)}
                </h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-dark">
                  {getLocalized(master.role, language)} · {experienceLabel(master.experienceYears, language)}
                </p>
                <p className="mt-3 inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-dark">
                  {master.discountPct > 0
                    ? `−${master.discountPct}% ${getLocalized(TR.discount, language)}`
                    : getLocalized(TR.basePrice, language)}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {getLocalized(master.description, language)}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
