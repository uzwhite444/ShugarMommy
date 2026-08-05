import { m, useReducedMotion } from 'motion/react';
import { Fragment } from 'react';
import { DUR, EASE_INK, VIEW } from '../../lib/motion';

interface SplitWordsProps {
  text: string;
  className?: string;
  /** Seconds before the first word starts. */
  delay?: number;
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean;
  /**
   * Drive the rise from a parent's own trigger instead of adding a second
   * observer. When this is passed, `inView` is ignored — a container and its
   * children must never be able to disagree about when the moment starts.
   */
  start?: boolean;
}

/**
 * Editorial masked text reveal: each word rises out of its own overflow mask
 * with a small stagger. The masks are `overflow-hidden` spans, so no ancestor
 * may animate `filter` — a blur applied above them bleeds straight through the
 * mask. Falls back to static text under prefers-reduced-motion.
 */
export default function SplitWords({ text, className, delay = 0, inView = false, start }: SplitWordsProps) {
  const reduced = useReducedMotion();

  if (reduced) return <span className={className}>{text}</span>;

  const words = text.split(' ');
  const target = { y: '0%' };
  const viewProps =
    start === undefined
      ? inView
        ? { whileInView: target, viewport: VIEW.far }
        : { animate: target }
      : { animate: start ? target : { y: '115%' } };

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        // The separating space is a text node BETWEEN the masks, never inside
        // one. A trailing space at the end of an `overflow-hidden inline-block`
        // is collapsed away by CSS text processing, so every split heading
        // rendered as one run-on word — and because two adjacent inline-blocks
        // with no whitespace between them offer no break opportunity, the
        // heading also could not wrap. A real space fixes both.
        <Fragment key={`${word}-${i}`}>
          <span aria-hidden className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-top">
            <m.span
              className="inline-block"
              initial={{ y: '115%' }}
              {...viewProps}
              transition={{ duration: DUR.slow, delay: delay + i * 0.05, ease: EASE_INK }}
            >
              {word}
            </m.span>
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </span>
  );
}
