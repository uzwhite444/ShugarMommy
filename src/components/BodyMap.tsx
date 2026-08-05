import { m, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { LanguageCode } from '../types';
import { SERVICE_ZONES } from '../data';
import { DUR, EASE_INK, VIEW } from '../lib/motion';
import { formatPrice, getLocalized } from '../utils';
import figure from '../assets/body-figure.webp';

interface BodyMapProps {
  language: LanguageCode;
  selectedZoneIds: string[];
  onToggleZone: (zoneId: string) => void;
}

interface MapPoint {
  zoneId: string;
  /** Percent coordinates over the figure image. */
  x: number;
  y: number;
  side: 'left' | 'right';
}

/* Anchor dots for the most-booked zones; fine-tuning stays in the list below.
   Percent coordinates match src/assets/body-figure.webp (full frame, untrimmed). */
const POINTS: MapPoint[] = [
  { zoneId: 'face-full', x: 49, y: 11, side: 'right' },
  { zoneId: 'underarms', x: 39, y: 23.5, side: 'left' },
  { zoneId: 'arms-full', x: 30, y: 45, side: 'left' },
  { zoneId: 'belly', x: 49, y: 38, side: 'right' },
  { zoneId: 'bikini-deep', x: 49, y: 51, side: 'right' },
  { zoneId: 'legs-full', x: 45, y: 63, side: 'left' },
  { zoneId: 'legs-half', x: 49, y: 81, side: 'right' },
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
export default function BodyMap({ language, selectedZoneIds, onToggleZone }: BodyMapProps) {
  const reduced = useReducedMotion();

  return (
    <div className="mb-12">
      <div className="relative mx-auto w-full max-w-[420px]">
        <img
          src={figure}
          alt=""
          aria-hidden
          width={683}
          height={1024}
          loading="lazy"
          draggable={false}
          className="body-figure mx-auto h-auto w-[240px] select-none sm:w-[270px]"
        />
        {POINTS.map((point, i) => {
          const zone = SERVICE_ZONES.find((z) => z.id === point.zoneId);
          if (!zone) return null;
          const selected = selectedZoneIds.includes(zone.id);
          const name = getLocalized(zone.name, language);
          return (
            <m.button
              key={zone.id}
              onClick={() => onToggleZone(zone.id)}
              aria-pressed={selected}
              title={`${name} · ${formatPrice(zone.price, language)}`}
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
              <span
                className={`hidden whitespace-nowrap text-[11px] font-semibold transition-colors sm:inline ${
                  selected ? 'text-ink' : 'text-muted group-hover:text-ink'
                }`}
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
