import { Star } from 'lucide-react';
import Reveal from './ui/Reveal';
import { REVIEWS } from '../data';
import { LanguageCode } from '../types';
import { getLocalized, INSTAGRAM } from '../utils';

interface ReviewsProps {
  language: LanguageCode;
}

const TR = {
  eyebrow: { RU: 'Отзывы', UZ: 'Fikrlar', EN: 'Reviews' },
  title: { RU: 'Что говорят клиентки', UZ: 'Mijozlar nima deydi', EN: 'What clients say' },
  more: { RU: 'Больше отзывов в Instagram', UZ: "Instagram'da ko'proq fikrlar", EN: 'More reviews on Instagram' },
};

export default function Reviews({ language }: ReviewsProps) {
  return (
    <section id="reviews" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {REVIEWS.map((review, i) => (
            <Reveal key={review.id} delay={(i % 2) * 0.06}>
              <blockquote className="flex h-full flex-col rounded-xl border border-hairline bg-canvas p-7">
                <div className="flex items-center gap-0.5 text-primary" aria-label={`${review.rating} / 5`}>
                  {Array.from({ length: review.rating }).map((_, starIdx) => (
                    <Star key={starIdx} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="mt-4 flex-1 font-serif text-xl font-medium leading-relaxed text-ink">
                  «{getLocalized(review.text, language)}»
                </p>
                <footer className="mt-5 border-t border-hairline pt-4">
                  <p className="text-sm font-semibold text-ink">{review.author}</p>
                  <p className="mt-0.5 text-xs text-muted">{getLocalized(review.service, language)}</p>
                </footer>
              </blockquote>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-8">
            <a
              href={`https://instagram.com/${INSTAGRAM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary-dark underline-offset-4 hover:underline"
            >
              {getLocalized(TR.more, language)} →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
