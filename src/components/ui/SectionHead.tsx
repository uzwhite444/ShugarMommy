import { m, useInView, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import SplitWords from './SplitWords';
import { DUR, EASE_INK, RISE, VIEW } from '../../lib/motion';

interface SectionHeadProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  /**
   * Give the title the masked word-rise instead of a plain lift. Reserved for
   * the page's two biggest editorial moments — used everywhere it stops being
   * a moment.
   */
  split?: boolean;
  className?: string;
}

/* Sequence, in seconds. The rule is doing visible work from the first frame,
   so nothing waits on an empty screen. */
const T_RULE = 0;
const T_EYEBROW = 0.14;
const T_TITLE = 0.24;
const T_SUBTITLE = 0.34;

/**
 * The section header entrance — and the page's only piece of choreography that
 * repeats on purpose.
 *
 * Twelve section headers used to share one anonymous 650ms fade-rise-deblur,
 * which is the single most template-signalling thing a landing page can do.
 * This is the site's own gesture instead: the hairline inks across the top of
 * the block over `--dur-sig` (the same 420ms the header's rule and the sticky
 * bar's rule already use), then the eyebrow lifts, then the serif title
 * resolves. Same primitive as hover, same curve, one scale up.
 *
 * ONE observer drives all four elements. The old arrangement nested a
 * `whileInView` container around children with their own `whileInView` and
 * different margins, so a container and its contents could — and did —
 * disagree about when the moment had started.
 */
export default function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  split = false,
  className,
}: SectionHeadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, VIEW.near);
  const on = reduced ? true : inView;

  const centered = align === 'center';
  const lift = (delay: number) => ({
    initial: { opacity: 0, y: RISE.text },
    animate: on ? { opacity: 1, y: 0 } : { opacity: 0, y: RISE.text },
    transition: { duration: DUR.base, ease: EASE_INK, delay },
  });

  return (
    <div ref={ref} className={`${centered ? 'text-center' : ''} ${className ?? ''}`}>
      {/* Where the section starts, drawn in the system's own 1px rule. */}
      <m.span
        aria-hidden
        className={`block h-px w-full bg-hairline ${centered ? 'origin-center' : 'origin-left'}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: on ? 1 : 0 }}
        transition={{ duration: 0.42, ease: EASE_INK, delay: T_RULE }}
      />

      {reduced ? (
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
      ) : (
        <m.p
          {...lift(T_EYEBROW)}
          className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted"
        >
          {eyebrow}
        </m.p>
      )}

      <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">
        {split ? (
          <SplitWords text={title} start={on} delay={T_TITLE} />
        ) : reduced ? (
          title
        ) : (
          <m.span {...lift(T_TITLE)} className="inline-block">
            {title}
          </m.span>
        )}
      </h2>

      {subtitle &&
        (reduced ? (
          <p
            className={`mt-4 text-sm leading-relaxed text-muted sm:text-base ${
              centered ? 'mx-auto max-w-md' : 'max-w-xl'
            }`}
          >
            {subtitle}
          </p>
        ) : (
          <m.p
            {...lift(T_SUBTITLE)}
            className={`mt-4 text-sm leading-relaxed text-muted sm:text-base ${
              centered ? 'mx-auto max-w-md' : 'max-w-xl'
            }`}
          >
            {subtitle}
          </m.p>
        ))}
    </div>
  );
}
