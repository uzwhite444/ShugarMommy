import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import { STAGGER } from '../lib/motion';
import { FAQ_ITEMS } from '../data';
import { LanguageCode } from '../types';
import { getLocalized } from '../utils';

interface FaqProps {
  language: LanguageCode;
}

const TR = {
  eyebrow: { RU: 'FAQ', UZ: 'FAQ', EN: 'FAQ' },
  title: { RU: 'Частые вопросы', UZ: 'Ko‘p so‘raladigan savollar', EN: 'Frequent questions' },
};

export default function Faq({ language }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-soft px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHead eyebrow={getLocalized(TR.eyebrow, language)} title={getLocalized(TR.title, language)} />
        {/* A list assembling itself, top-down: the tightest stagger there is
            (40ms), because eleven questions arriving at card pace would be an
            eleven-beat wait for the first answer. */}
        <Stagger className="mt-12 border-t border-hairline" step={STAGGER.tight} delay={0.1}>
          {FAQ_ITEMS.map((item, i) => {
            const open = openIndex === i;
            return (
              <StaggerItem key={item.question.EN}>
                <div className="border-b border-hairline">
                  <button
                    onClick={() => setOpenIndex(open ? null : i)}
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    className="btn-press ink-rule rule-row rule-long flex w-full items-center justify-between gap-4 py-5 text-left font-serif text-xl font-medium text-ink hover:text-primary-dark"
                  >
                    {getLocalized(item.question, language)}
                    <ChevronDown
                      size={18}
                      className={`chevron-turn shrink-0 text-muted ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {/* aria-hidden keeps collapsed answers out of the a11y tree —
                      zero-height clipping alone leaves them readable by AT. */}
                  <div
                    id={`faq-panel-${i}`}
                    aria-hidden={!open}
                    // Explicit properties, never `transition-all`: that caught
                    // every animatable property on the element. Tailwind
                    // utilities are not covered by the reduced-motion block in
                    // index.css, which only names custom selectors, so the guard
                    // has to be written here.
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-xl pb-6 text-sm leading-relaxed text-muted">
                        {getLocalized(item.answer, language)}
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
