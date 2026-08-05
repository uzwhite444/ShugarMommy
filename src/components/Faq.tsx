import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Reveal from './ui/Reveal';
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
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
        </Reveal>
        <div className="mt-12 border-t border-hairline">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIndex === i;
            return (
              <Reveal key={item.question.EN} delay={i * 0.04}>
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
                    className={`grid transition-all duration-300 ease-out ${
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
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
