import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import { STAGGER } from '../lib/motion';
import { CATEGORY_LABELS, CATEGORY_ORDER, findZone, MASTERS } from '../data';
import { LanguageCode, ZoneCategory } from '../types';
import { formatExperience, getLocalized, masterInitial } from '../utils';

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
  onlyHer: { RU: 'Только у неё', UZ: 'Faqat unda', EN: 'Only with her' },
};

/**
 * master.id → the categories nobody else in the line-up performs.
 *
 * Derived from the roster instead of written out, because this claim expires:
 * the card must stop saying "только у неё" the day a second master picks the
 * category up, and a hand-typed list would keep saying it. Computed once —
 * MASTERS and the zone table are module constants.
 */
const SOLO_CATEGORIES: Readonly<Record<string, readonly ZoneCategory[]>> = (() => {
  const result: Record<string, ZoneCategory[]> = {};
  for (const category of CATEGORY_ORDER) {
    const performers = MASTERS.filter((master) =>
      master.zoneIds.some((id) => findZone(id)?.category === category),
    );
    const only = performers.length === 1 ? performers[0] : undefined;
    if (!only) continue;
    (result[only.id] ??= []).push(category);
  }
  return result;
})();

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
            leaves a dead cell, so a pair centres in a narrower track instead and
            the third column only appears once there is a third master.
            Loosest stagger on the page (100ms) so each name gets its own beat. */}
        <Stagger
          className={`mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            MASTERS.length > 2 ? 'lg:grid-cols-3' : 'mx-auto max-w-4xl'
          }`}
          step={STAGGER.loose}
          delay={0.12}
        >
          {MASTERS.map((master) => {
            const solo = SOLO_CATEGORIES[master.id] ?? [];
            return (
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
                      {master.experienceMonths !== undefined &&
                        ` · ${formatExperience(master.experienceMonths, language)}`}
                    </p>
                    {master.credentials && (
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        {getLocalized(master.credentials, language)}
                      </p>
                    )}
                    {solo.length > 0 && (
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        <span className="font-semibold text-ink">
                          {getLocalized(TR.onlyHer, language)}:
                        </span>{' '}
                        {solo.map((category) => getLocalized(CATEGORY_LABELS[category], language)).join(' · ')}
                      </p>
                    )}
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
