import { m, useReducedMotion, type TargetAndTransition } from 'motion/react';
import type { ReactNode } from 'react';
import { DUR, EASE_INK, RISE, VIEW } from '../../lib/motion';

export type RevealVariant = 'rise' | 'plate' | 'veil';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /**
   * What is entering, not how far it moves:
   *   rise  — type and small blocks; a short lift.
   *   plate — a surface arriving; further and slower, so a card reads heavier
   *           than a line of text.
   *   veil  — opacity only. NEVER writes a transform, so it is the only variant
   *           safe above `mix-blend-mode` content (a transform on an ancestor
   *           creates a stacking context and isolates the blend).
   */
  variant?: RevealVariant;
  /** Seconds before this element starts. For groups use `<Stagger>` instead. */
  delay?: number;
  /** Viewport trigger tier — see VIEW in src/lib/motion.ts. */
  trigger?: keyof typeof VIEW;
}

const VARIANTS: Record<
  RevealVariant,
  { from: TargetAndTransition; to: TargetAndTransition; duration: number }
> = {
  rise: { from: { opacity: 0, y: RISE.text }, to: { opacity: 1, y: 0 }, duration: DUR.base },
  plate: { from: { opacity: 0, y: RISE.plate }, to: { opacity: 1, y: 0 }, duration: DUR.slow },
  veil: { from: { opacity: 0 }, to: { opacity: 1 }, duration: DUR.slow },
};

/**
 * Single-element scroll entrance.
 *
 * The blur channel this used to carry is gone for good. `filter: blur(0px)` is
 * not a no-op — any filter creates a stacking context, which isolates
 * `mix-blend-mode` in the subtree, and the hand-rolled `style.filter = ''`
 * cleanup that tried to undo it lost the race often enough that 19-70 elements
 * sat in permanent stacking contexts after a full-page scroll. `clip-path`
 * would have swapped one stacking-context creator for another. Opacity and
 * transform are the only two channels whose resting values (`1` and `none`)
 * create nothing at all, so they are the only two used here.
 *
 * Under prefers-reduced-motion this renders a plain div: the content is present
 * and opaque on the first frame and never waits on an observer.
 */
export default function Reveal({
  children,
  className,
  variant = 'rise',
  delay = 0,
  trigger = 'near',
}: RevealProps) {
  const reduced = useReducedMotion();
  const spec = VARIANTS[variant];

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      initial={spec.from}
      whileInView={spec.to}
      viewport={VIEW[trigger]}
      transition={{ duration: spec.duration, ease: EASE_INK, delay }}
    >
      {children}
    </m.div>
  );
}
