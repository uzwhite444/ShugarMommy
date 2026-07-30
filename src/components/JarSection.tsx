import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import Reveal from './ui/Reveal';
import { LanguageCode } from '../types';
import { getLocalized } from '../utils';
import jarEmpty from '../assets/jar-empty.webp';
import jarFull from '../assets/jar-full.webp';

interface JarSectionProps {
  language: LanguageCode;
}

const TR = {
  eyebrow: { RU: 'Собственная варка', UZ: "O'z tayyorlovimiz", EN: 'Made in-house' },
  title: {
    RU: 'Каждая капля — в дело',
    UZ: 'Har bir tomchi — ishga',
    EN: 'Every drop put to work',
  },
  text: {
    RU: 'Варим пасту небольшими партиями и храним в стекле — на вашу процедуру всегда идёт свежая.',
    UZ: "Pastani kichik partiyalarda tayyorlaymiz va shishada saqlaymiz — muolajangizga doim yangi pasta ishlatiladi.",
    EN: 'We cook the paste in small batches and store it in glass — your procedure always gets a fresh one.',
  },
  alt: { RU: 'Банка сахарной пасты', UZ: 'Shakar pastasi bankasi', EN: 'A jar of sugaring paste' },
};

/**
 * The end of the liquid journey: the stream from LiquidJourney pours into
 * this jar, and the jar fills up (empty → full crossreveal, clipped from the
 * bottom) as it scrolls into view.
 */
export default function JarSection({ language }: JarSectionProps) {
  const reduced = useReducedMotion();
  const jarRef = useRef<HTMLDivElement>(null);

  // 0 → 1 while the jar rises through the lower quarter of the viewport —
  // the end offset must stay reachable near the page bottom.
  const { scrollYProgress } = useScroll({ target: jarRef, offset: ['start 0.98', 'start 0.72'] });
  const fill = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  // Reveal the "full" render from the bottom up = paste level rising.
  const clip = useTransform(fill, (p) => `inset(${(1 - (reduced ? 1 : p)) * 78 + 4}% 0% 0% 0%)`);

  return (
    <section className="px-4 pb-4 pt-8 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto]">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-3 text-3xl text-ink sm:text-4xl">{getLocalized(TR.title, language)}</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{getLocalized(TR.text, language)}</p>
        </Reveal>

        <div id="jar-anchor" ref={jarRef} className="relative justify-self-center lg:justify-self-end">
          <img
            src={jarEmpty}
            alt={getLocalized(TR.alt, language)}
            width={480}
            height={480}
            loading="lazy"
            draggable={false}
            className="h-44 w-44 select-none sm:h-52 sm:w-52"
          />
          {/* Same jar, same framing, filled — revealed bottom-up with scroll. */}
          <motion.img
            src={jarFull}
            alt=""
            aria-hidden
            width={480}
            height={480}
            loading="lazy"
            draggable={false}
            style={{ clipPath: clip }}
            className="absolute inset-0 h-44 w-44 select-none sm:h-52 sm:w-52"
          />
        </div>
      </div>
    </section>
  );
}
