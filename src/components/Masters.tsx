import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import { STAGGER } from '../lib/motion';
import { MASTERS } from '../data';
import { LanguageCode } from '../types';
import { getLocalized, masterInitial } from '../utils';

interface MastersProps {
  language: LanguageCode;
}

const TR = {
  eyebrow: { RU: 'Команда', UZ: 'Jamoa', EN: 'The team' },
  title: { RU: 'Наши мастера', UZ: 'Bizning ustalar', EN: 'Our masters' },
  subtitle: {
    RU: 'Сертифицированные мастера студии. Выбрать мастера можно при записи.',
    UZ: 'Studiyaning sertifikatlangan ustalari. Ustani yozilish paytida tanlash mumkin.',
    EN: 'Certified masters of the studio. Pick yours when you book.',
  },
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
        {/* Column count follows the roster: a three-column grid with two masters
            leaves a dead cell, so the pair centres in a narrower track instead
            and the third column only appears once there is a third master.
            Loosest stagger on the page (100ms) so each name gets its own beat. */}
        <Stagger
          className={`mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            MASTERS.length > 2 ? 'lg:grid-cols-3' : 'mx-auto max-w-4xl'
          }`}
          step={STAGGER.loose}
          delay={0.12}
        >
          {MASTERS.map((master) => (
            <StaggerItem key={master.id} variant="plate">
              {/* Avatar beside the name rather than above it: the studio has
                  given no master bios, so a stacked card would be mostly empty
                  space under the title line. */}
              <article className="flex h-full items-center gap-5 rounded-xl bg-canvas p-7">
                {/* Placeholder until a real photo is added — the initials repeat
                    the name below, so they are decorative to a screen reader. */}
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-soft font-serif text-2xl font-semibold text-primary-dark"
                >
                  {masterInitial(master, language)}
                </div>
                <div className="min-w-0">
                  <h3 className="display text-2xl text-ink">{getLocalized(master.name, language)}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-dark">
                    {getLocalized(master.title, language)}
                    {/* Only the masters the studio actually gave a number for. */}
                    {master.experienceYears !== undefined &&
                      ` · ${experienceLabel(master.experienceYears, language)}`}
                  </p>
                  {master.credentials && (
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {getLocalized(master.credentials, language)}
                    </p>
                  )}
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
