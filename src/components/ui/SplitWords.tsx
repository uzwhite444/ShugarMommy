import { m, useReducedMotion } from 'motion/react';

interface SplitWordsProps {
  text: string;
  className?: string;
  /** Seconds before the first word starts. */
  delay?: number;
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Editorial masked text reveal: each word rises out of its own overflow
 * mask with a small stagger — the signature entrance of premium editorial
 * sites. Falls back to static text under prefers-reduced-motion.
 */
export default function SplitWords({ text, className, delay = 0, inView = false }: SplitWordsProps) {
  const reduced = useReducedMotion();

  if (reduced) return <span className={className}>{text}</span>;

  const words = text.split(' ');
  const target = { y: '0%' };
  const viewProps = inView
    ? { whileInView: target, viewport: { once: true, margin: '-80px' } }
    : { animate: target };

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden
          className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-top"
        >
          <m.span
            className="inline-block"
            initial={{ y: '115%' }}
            {...viewProps}
            transition={{ duration: 0.75, delay: delay + i * 0.05, ease: EASE }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </m.span>
        </span>
      ))}
    </span>
  );
}
