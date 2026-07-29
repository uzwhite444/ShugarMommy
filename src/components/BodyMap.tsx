import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { LanguageCode } from '../types';
import { SERVICE_ZONES } from '../data';
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
          className="mx-auto h-auto w-[240px] select-none mix-blend-multiply sm:w-[270px]"
        />
        {POINTS.map((point, i) => {
          const zone = SERVICE_ZONES.find((z) => z.id === point.zoneId);
          if (!zone) return null;
          const selected = selectedZoneIds.includes(zone.id);
          const name = getLocalized(zone.name, language);
          return (
            <motion.button
              key={zone.id}
              onClick={() => onToggleZone(zone.id)}
              aria-pressed={selected}
              title={`${name} · ${formatPrice(zone.price, language)}`}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className={`group absolute flex items-center gap-1.5 ${
                point.side === 'left' ? 'flex-row-reverse' : ''
              }`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: `translate(${point.side === 'left' ? '-100%' : '0'}, -50%)`,
              }}
            >
              <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected
                    ? 'border-primary bg-primary text-white'
                    : 'border-primary bg-canvas group-hover:bg-primary-soft'
                }`}
              >
                {selected && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span aria-hidden className={`hidden h-px w-4 sm:block ${selected ? 'bg-primary/70' : 'bg-primary/40'}`} />
              <span
                className={`hidden whitespace-nowrap text-[11px] font-semibold transition-colors sm:inline ${
                  selected ? 'text-ink' : 'text-muted group-hover:text-ink'
                }`}
              >
                {name}
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-faint">{getLocalized(TR_HINT, language)}</p>
    </div>
  );
}
