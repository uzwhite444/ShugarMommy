import { m, useReducedMotion, type Variants } from 'motion/react';
import { useMemo, type ReactNode, type Ref } from 'react';
import { DUR, EASE_INK, RISE, STAGGER, VIEW } from '../../lib/motion';

type ParentTag = 'div' | 'ul' | 'ol';
type ItemTag = 'div' | 'li';

export type StaggerVariant = 'rise' | 'plate' | 'veil' | 'frame';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  as?: ParentTag;
  /** Seconds between consecutive children. */
  step?: number;
  /** Seconds before the first child. */
  delay?: number;
  trigger?: keyof typeof VIEW;
  /** Forwarded to the rendered element — e.g. as a `useScroll` target. */
  ref?: Ref<HTMLElement>;
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  as?: ItemTag;
  variant?: StaggerVariant;
}

const ITEM: Record<StaggerVariant, Variants> = {
  /** Type and small blocks. */
  rise: {
    hidden: { opacity: 0, y: RISE.text },
    shown: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_INK } },
  },
  /** A surface with mass — further, slower. */
  plate: {
    hidden: { opacity: 0, y: RISE.plate },
    shown: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_INK } },
  },
  /** Opacity only: things that should appear rather than arrive. */
  veil: {
    hidden: { opacity: 0 },
    shown: { opacity: 1, transition: { duration: DUR.slow, ease: EASE_INK } },
  },
  /** Imagery settling out of a slight overscale — no text, so no re-raster. */
  frame: {
    hidden: { opacity: 0, scale: 1.04 },
    shown: { opacity: 1, scale: 1, transition: { duration: DUR.slow, ease: EASE_INK } },
  },
};

/**
 * Variant parent for a group of siblings.
 *
 * Order comes from DOM order at the CURRENT breakpoint, which is the whole
 * point: the delays this replaces were computed from the array index in JS
 * (`i * 0.06`, `(i % 3) * 0.06`) while the column count was decided in CSS, so
 * every one of them read as noise below its design breakpoint — and on a
 * one-column phone layout a 5th card waited 240ms after entering view before it
 * began. `staggerChildren` cannot desynchronise from the layout because it does
 * not know about the layout.
 */
export function Stagger({
  children,
  className,
  as = 'div',
  step = STAGGER.base,
  delay = 0,
  trigger = 'near',
  ref,
}: StaggerProps) {
  const reduced = useReducedMotion();
  const Tag = m[as] as typeof m.div;
  const variants: Variants = useMemo(
    () => ({ hidden: {}, shown: { transition: { staggerChildren: step, delayChildren: delay } } }),
    [step, delay],
  );

  if (reduced) {
    if (as === 'ul')
      return (
        <ul ref={ref as Ref<HTMLUListElement>} className={className}>
          {children}
        </ul>
      );
    if (as === 'ol')
      return (
        <ol ref={ref as Ref<HTMLOListElement>} className={className}>
          {children}
        </ol>
      );
    return (
      <div ref={ref as Ref<HTMLDivElement>} className={className}>
        {children}
      </div>
    );
  }

  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={VIEW[trigger]}
      variants={variants}
    >
      {children}
    </Tag>
  );
}

/** A child of `<Stagger>`. Inherits its start time from the parent's chain. */
export function StaggerItem({ children, className, as = 'div', variant = 'rise' }: StaggerItemProps) {
  const reduced = useReducedMotion();
  const Tag = m[as] as typeof m.div;

  if (reduced) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag className={className} variants={ITEM[variant]}>
      {children}
    </Tag>
  );
}
