import { m, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { LanguageCode, Master, ServiceZone } from '../types';
import { SERVICE_ZONES } from '../data';
import { DUR, EASE_INK, VIEW } from '../lib/motion';
import { getLocalized } from '../utils';
import figure from '../assets/body-figure.webp';

interface BodyMapProps {
  language: LanguageCode;
  selectedZoneIds: string[];
  onToggleZone: (zoneId: string) => void;
  /**
   * Whose price list the section is showing, or null for "любой мастер". Dots
   * for zones she does not perform are not drawn — tapping one would put a zone
   * in the basket that the chosen master cannot do.
   */
  master?: Master | null;
  /**
   * Renders a zone's price for the CURRENT master, «от …» included. Supplied by
   * the parent rather than computed here so the map and the price list can
   * never word the same price two different ways.
   */
  priceLabel: (zone: ServiceZone) => string;
}

interface MapPoint {
  zoneId: string;
  /** Percent coordinates over the figure image. */
  x: number;
  y: number;
  side: 'left' | 'right';
}

/* Anchor dots for the most-booked zones; the rest of the price list is one
   scroll below. Percent coordinates are measured on the artwork in
   src/assets/body-figure.webp (full frame, untrimmed) and are anchored to a box
   that is exactly the image — see the wrapper in the markup below.

   Head to toe, which is also the order they fade in.

   Only zones visible from the front: спина, поясница and ягодицы are in the
   price list but have no honest anchor on a front-facing figure.

   NO FACE DOT, even though the face zones are published now. The figure is a
   full-body drawing, so the head occupies roughly y 4–17% and the upper lip
   lands near y 15%, x 48%. At the narrowest rendering (240px wide → 360px tall)
   that is 27px above and ~20px across from the underarm anchor at (40, 22.5) —
   both inside the 44px touch target, so the two hit areas would overlap and
   steal each other's taps. Face zones are reachable in the list below, in their
   own category block.

   Spacing rule: the touch targets are 44px, so two dots must sit further than
   that apart on at least one axis at the narrowest rendering (240px figure),
   or their invisible hit areas would overlap and steal each other's taps. */
const POINTS: MapPoint[] = [
  { zoneId: 'underarms', x: 40, y: 22.5, side: 'left' },
  { zoneId: 'arms-full', x: 36, y: 37, side: 'left' },
  { zoneId: 'belly', x: 56, y: 42, side: 'right' },
  { zoneId: 'hands', x: 31.5, y: 50, side: 'left' },
  { zoneId: 'bikini-deep', x: 51, y: 55, side: 'right' },
  { zoneId: 'thighs', x: 45, y: 68, side: 'left' },
  { zoneId: 'legs-half', x: 53, y: 82, side: 'right' },
];

const TR_HINT = {
  RU: 'Коснитесь точки на карте — зона добавится в комплекс',
  UZ: "Xaritadagi nuqtaga tegining — zona kompleksga qo'shiladi",
  EN: 'Tap a dot on the map to add the zone to your combo',
};

/**
 * Interactive zone map: an elegant line-art figure with tappable dots wired
 * to the same selection state as the price list — pick zones on the body.
 */
export default function BodyMap({
  language,
  selectedZoneIds,
  onToggleZone,
  master,
  priceLabel,
}: BodyMapProps) {
  const reduced = useReducedMotion();

  return (
    <div className="mb-12">
      {/* The anchor box IS the figure, not a wider centred column: a dot's
          percentage has to land on the same rib at every viewport width, and it
          only does that when the positioning context is the image itself.
          `relative` alone creates no stacking context, so `.body-figure` below
          keeps blending against the section — which is the whole reason nothing
          around here may animate. */}
      <div className="relative mx-auto w-[240px] sm:w-[270px]">
        <img
          src={figure}
          alt=""
          aria-hidden
          width={683}
          height={1024}
          loading="lazy"
          draggable={false}
          className="body-figure block h-auto w-full select-none"
        />
        {POINTS.map((point, i) => {
          const zone = SERVICE_ZONES.find((z) => z.id === point.zoneId);
          if (!zone) return null;
          if (master && !master.zoneIds.includes(zone.id)) return null;
          const selected = selectedZoneIds.includes(zone.id);
          const name = getLocalized(zone.name, language);
          // The tooltip is read on its own, away from the picker above it, so a
          // master's price carries her name with it.
          const title = master
            ? `${name} · ${priceLabel(zone)} · ${getLocalized(master.name, language)}`
            : `${name} · ${priceLabel(zone)}`;
          return (
            <m.button
              key={zone.id}
              onClick={() => onToggleZone(zone.id)}
              aria-pressed={selected}
              title={title}
              // The dots ARE this figure's entrance: nothing may animate above
              // them, because a stacking context on any ancestor of
              // `.body-figure` isolates its mix-blend-mode and the artwork
              // renders its own cream plate. Head to toe, one at a time.
              // Reduced motion gets them present and full-size on frame 1 —
              // never invisible waiting on an observer.
              initial={reduced ? false : { opacity: 0, scale: 0.5 }}
              whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
              viewport={VIEW.tight}
              transition={{ duration: DUR.quick, delay: 0.1 + i * 0.07, ease: EASE_INK }}
              // press-inner, never btn-press: this element's transform belongs
              // to motion's x/y channel below, so a CSS transform here would be
              // overwritten every frame and knock the dot off its anchor.
              className={`group press-inner absolute flex items-center ${
                point.side === 'left' ? 'flex-row-reverse' : ''
              }`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                // The 44px hit area is centred on the dot, so pull the row back
                // by half of it to keep the visual dot exactly on the anchor.
                // This must ride motion's own x/y channel: a raw style.transform
                // is overwritten as soon as scale animates, which would knock
                // every dot off its anchor.
                x: point.side === 'left' ? 'calc(-100% + 22px)' : '-22px',
                y: '-50%',
              }}
            >
              {/* 44px touch target around an 18px visual dot: the padding is
                  transparent, so the map stays clean but stays tappable. */}
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                <span
                  // `scale`, not `transform`: the selected state below is
                  // Tailwind's `scale-110`, which v4 emits as the independent
                  // `scale` property — omitting it here makes the dot snap.
                  className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform,scale] duration-200 motion-reduce:transition-none ${
                    selected
                      ? 'scale-110 border-primary bg-primary text-white'
                      : 'border-primary bg-canvas group-hover:bg-primary-soft'
                  }`}
                >
                  {selected && <Check size={10} strokeWidth={3.5} />}
                </span>
              </span>
              {/* The connector draws toward its label — the map's own version of
                  the signature. scaleX, never w-4 -> w-5: that is a width. */}
              <span
                aria-hidden
                className={`map-connector hidden h-px w-4 sm:block ${
                  point.side === 'left' ? 'map-connector-flip' : ''
                } ${selected ? 'map-connector-on bg-primary/70' : 'bg-primary/40'}`}
              />
              {/* The studio's official wording is long — "Голени с захватом
                  колена + пальчики" — and it may not be paraphrased, so the
                  label wraps inside a fixed measure instead of running off the
                  section on one line. It aligns toward its own dot. */}
              <span
                className={`hidden max-w-[124px] text-[11px] font-semibold leading-tight transition-colors sm:block ${
                  point.side === 'left' ? 'text-right' : 'text-left'
                } ${selected ? 'text-ink' : 'text-muted group-hover:text-ink'}`}
              >
                {name}
              </span>
            </m.button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-faint">{getLocalized(TR_HINT, language)}</p>
    </div>
  );
}
