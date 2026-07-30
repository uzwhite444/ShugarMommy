import Reveal from './ui/Reveal';
import Counter from './ui/Counter';
import { LanguageCode, Localized } from '../types';
import { getLocalized } from '../utils';

interface StatsBandProps {
  language: LanguageCode;
}

interface Stat {
  to: number;
  decimals?: number;
  suffix?: string;
  label: Localized;
}

/* Цифры — маркетинговые, отредактируйте под реальные показатели студии. */
const STATS: Stat[] = [
  { to: 1000, suffix: '+', label: { RU: 'довольных клиенток', UZ: 'mamnun mijozlar', EN: 'happy clients' } },
  { to: 12, label: { RU: 'лет суммарного опыта', UZ: 'yillik umumiy tajriba', EN: 'years of combined experience' } },
  { to: 4.9, decimals: 1, label: { RU: 'средняя оценка', UZ: "o'rtacha baho", EN: 'average rating' } },
  { to: 98, suffix: '%', label: { RU: 'возвращаются снова', UZ: 'yana qaytishadi', EN: 'come back again' } },
];

/** Quiet numbers row separated by hairlines — no dark band, no decoration. */
export default function StatsBand({ language }: StatsBandProps) {
  return (
    <section id="stats-band" className="border-y border-hairline px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, i) => (
          <div
            key={stat.label.EN}
            className={`py-10 pr-4 ${i % 2 === 1 ? 'border-l border-hairline pl-6' : ''} ${
              i >= 2 ? 'border-t border-hairline lg:border-t-0' : ''
            } ${i >= 1 ? 'lg:border-l lg:border-hairline lg:pl-8' : ''}`}
          >
            <Reveal delay={i * 0.06}>
              <p className="display text-4xl text-ink sm:text-5xl">
                <Counter to={stat.to} decimals={stat.decimals} suffix={stat.suffix} />
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
                {getLocalized(stat.label, language)}
              </p>
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}
