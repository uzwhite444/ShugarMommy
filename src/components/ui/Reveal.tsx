import { m, useReducedMotion } from 'motion/react';
import { useRef, type ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before the reveal starts — use to stagger siblings. */
  delay?: number;
  /** Vertical travel distance in px (ignored under reduced-motion). */
  y?: number;
  /** Animation duration in seconds. */
  duration?: number;
}

/**
 * Scroll-triggered entrance: fade + rise + a soft blur that resolves to
 * sharp (the Linear-style "focus in" effect). Reveals once per element and
 * honours prefers-reduced-motion with a plain fade.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
  duration = 0.65,
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <m.div
      ref={ref}
      className={className}
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y, filter: 'blur(6px)' }
      }
      whileInView={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 1, y: 0, filter: 'blur(0px)' }
      }
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration, ease: [0.22, 1, 0.36, 1], delay }}
      // A settled `filter: blur(0px)` is not a no-op: any filter creates a
      // stacking context, which isolates mix-blend-mode in the subtree. That
      // made the body-map figure render its own cream plate instead of
      // blending into the page. Clearing it also drops a permanent
      // compositing layer per revealed block.
      onAnimationComplete={() => {
        if (ref.current) ref.current.style.filter = '';
      }}
    >
      {children}
    </m.div>
  );
}
