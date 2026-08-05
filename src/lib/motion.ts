/* ---------------------------------------------------------------------------
   THE LINE, at page scale — the JS half of the motion system.

   index.css:63-85 already tokenises every interaction duration so the
   reduced-motion block at the end of that file can neutralise the whole system
   from one place. The scroll layer used to be magic numbers scattered across
   thirteen components: five different viewport margins, one hardcoded duration
   repeated sixty-four times. These are its tokens.

   Rules of the system:
   - Only `transform` and `opacity` ever animate on a wrapper. Never `filter`,
     never `clip-path`: BOTH create a stacking context, and a stacking context
     isolates `mix-blend-mode` in the subtree — which is what made the body-map
     figure and the paste video render their own cream plates. `opacity: 1` and
     `transform: none` are the only resting values that create nothing, so they
     are the only channels a wrapper is allowed to use.
   - Trigger distance scales with the size of the thing entering, the same way
     `--draw-short/med/long` scale with the distance the nib travels.
   - Under `prefers-reduced-motion` every primitive renders its content at rest
     on the first frame — not "a fade instead of a rise". Content must never
     depend on an IntersectionObserver firing.
--------------------------------------------------------------------------- */

/** The ink curve — identical to `--ease-ink` in index.css. */
export const EASE_INK = [0.22, 1, 0.36, 1] as const;

/**
 * Viewport triggers. Bigger things need to be further in before they commit,
 * so a full-width figure does not start while it is a sliver at the fold.
 */
export const VIEW = {
  /** Small marks: dots, rows, list items, progress rules. */
  tight: { once: true, margin: '-24px' },
  /** The default: cards, blocks, section headers. */
  near: { once: true, margin: '-72px' },
  /** Large surfaces: figures, dark bands, the quiz card. */
  far: { once: true, margin: '-120px' },
} as const;

/** Entry durations. Exit stays 0.6x entry by the same rule the CSS uses. */
export const DUR = {
  /** A mark landing — dots, rows. */
  quick: 0.42,
  /** The workhorse. */
  base: 0.55,
  /** Big surfaces and type. */
  slow: 0.72,
} as const;

/**
 * Child stagger. Always applied by a variant PARENT so the order comes from
 * DOM order at the current breakpoint — never from an array index, which is
 * computed in JS while the column count is decided in CSS.
 */
export const STAGGER = {
  /** Dense lists — FAQ rows, price rows. */
  tight: 0.04,
  /** Cards in a grid. */
  base: 0.07,
  /** A short row of people or offers, introduced one at a time. */
  loose: 0.1,
} as const;

/** Travel distances. A hairline system does not need big moves. */
export const RISE = {
  /** Type and small marks. */
  text: 10,
  /** Cards and plates. */
  plate: 16,
} as const;
