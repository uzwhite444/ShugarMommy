import { useRef } from 'react';
import { m, useInView, useReducedMotion } from 'motion/react';
import Reveal from './ui/Reveal';
import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import LiquidVideo from './ui/LiquidVideo';
import { LanguageCode, Localized } from '../types';
import { getLocalized } from '../utils';
import { EASE_INK, STAGGER } from '../lib/motion';
import pasteDrop from '../assets/paste-drop.webp';

interface IngredientsProps {
  language: LanguageCode;
}

interface Ingredient {
  name: Localized;
  note: Localized;
}

const TR = {
  eyebrow: { RU: 'Состав пасты', UZ: 'Pasta tarkibi', EN: 'Paste ingredients' },
  title: { RU: 'Только три ингредиента', UZ: 'Faqat uch ingredient', EN: 'Just three ingredients' },
  subtitle: {
    RU: 'Никакого воска, смол и отдушек. Паста работает при температуре тела и не обжигает кожу.',
    UZ: 'Mum, smola va atirsiz. Pasta tana haroratida ishlaydi va terini kuydirmaydi.',
    EN: 'No wax, resins or fragrance. The paste works at body temperature and never burns the skin.',
  },
  left: [
    {
      name: { RU: 'Сахар', UZ: 'Shakar', EN: 'Sugar' },
      note: {
        RU: 'Карамелизован до янтарного оттенка',
        UZ: 'Yantar rangigacha karamellangan',
        EN: 'Caramelised to an amber hue',
      },
    },
    {
      name: { RU: 'Вода', UZ: 'Suv', EN: 'Water' },
      note: {
        RU: 'Очищенная, для мягкой пластичности',
        UZ: 'Tozalangan, yumshoq plastiklik uchun',
        EN: 'Purified, for soft plasticity',
      },
    },
  ] as Ingredient[],
  right: [
    {
      name: { RU: 'Лимонный сок', UZ: 'Limon sharbati', EN: 'Lemon juice' },
      note: {
        RU: 'Природный консервант и антисептик',
        UZ: 'Tabiiy konservant va antiseptik',
        EN: 'Natural preservative and antiseptic',
      },
    },
    {
      name: { RU: '0% воска', UZ: '0% mum', EN: '0% wax' },
      note: {
        RU: 'Гипоаллергенно даже для чувствительной кожи',
        UZ: 'Sezgir teri uchun ham gipoallergen',
        EN: 'Hypoallergenic even for sensitive skin',
      },
    },
  ] as Ingredient[],
  alt: { RU: 'Капля сахарной пасты', UZ: 'Shakar pastasi tomchisi', EN: 'A drop of sugaring paste' },
};

/* The callout's own hairline inks toward the object it describes: on the left
   column it draws from the right edge inward, on the right column from the
   left. Same gesture as every hover rule on the page, one beat behind its
   label. */
const RULE_VARIANTS = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 0.42, ease: EASE_INK } },
};

function IngredientLabel({
  item,
  language,
  align,
  animated,
}: {
  item: Ingredient;
  language: LanguageCode;
  align: 'left' | 'right';
  animated: boolean;
}) {
  const ruleCls = `mt-3 block h-px w-10 bg-primary ${align === 'right' ? 'lg:ml-auto lg:origin-right' : 'origin-left'}`;
  return (
    <div className={align === 'right' ? 'lg:text-right' : ''}>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink">{getLocalized(item.name, language)}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{getLocalized(item.note, language)}</p>
      {animated ? (
        <m.span aria-hidden className={ruleCls} variants={RULE_VARIANTS} />
      ) : (
        <span aria-hidden className={ruleCls} />
      )}
    </div>
  );
}

/**
 * Centerpiece section: the paste itself as a floating 3D object with
 * ingredient callouts on either side — the one continuously-moving element
 * on the page, and it moves very little.
 */
export default function Ingredients({ language }: IngredientsProps) {
  const reduced = useReducedMotion();
  const shadowRef = useRef<HTMLDivElement>(null);

  // The breathing shadow is the only endless loop on the page — it must not
  // keep the compositor busy while the section sits offscreen.
  const shadowInView = useInView(shadowRef, { margin: '-10% 0px' });
  const shadowBreathing = !reduced && shadowInView;

  return (
    <section id="ingredients" className="overflow-hidden px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          align="center"
          split
          eyebrow={getLocalized(TR.eyebrow, language)}
          title={getLocalized(TR.title, language)}
          subtitle={getLocalized(TR.subtitle, language)}
        />

        <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-14">
          {/* Left callouts — one Stagger per column, so the order is the column's
              own DOM order at every breakpoint. The old index delays were
              computed against the lg 3-column layout while the left column is
              `order-2` on mobile, so below lg they ran against the visual order. */}
          <Stagger
            className="order-2 grid grid-cols-2 gap-8 lg:order-1 lg:grid-cols-1 lg:gap-14 lg:justify-items-end"
            step={STAGGER.loose}
          >
            {TR.left.map((item) => (
              <StaggerItem key={item.name.EN}>
                <IngredientLabel item={item} language={language} align="right" animated={!reduced} />
              </StaggerItem>
            ))}
          </Stagger>

          {/* The object.
              `veil` and nothing else: this wrapper is an ancestor of
              `.liquid-video`, whose `mix-blend-mode: darken` is isolated by ANY
              stacking context above it. It used to carry a blur AND a live
              parallax transform at the same time, which is why the clip rendered
              as a lighter cream plate instead of melting into the canvas — and
              why clearing the filter alone could never have fixed it. The
              parallax is gone (28px of travel nobody could consciously perceive,
              structurally incompatible with the blend) and the entrance is
              opacity-only, so no transform is ever written here. */}
          <div id="paste-anchor" className="order-1 justify-self-center lg:order-2">
            <Reveal variant="veil" trigger="far">
              {/* Higgsfield film: a droplet falls into the standing drop with
                  a crown splash, ripples and settles — loops while in view. */}
              <LiquidVideo
                // /videos/* is served immutable for a year, so a re-encode must
                // ship under a new filename or cached clients keep the old one.
                src="/videos/paste-drop-v2.mp4"
                label={getLocalized(TR.alt, language)}
                loop
                className="h-80 w-80 select-none object-cover sm:h-[420px] sm:w-[420px]"
                fallback={
                  <img
                    src={pasteDrop}
                    alt={getLocalized(TR.alt, language)}
                    width={461}
                    height={760}
                    loading="lazy"
                    className="h-72 w-auto select-none sm:h-96"
                    draggable={false}
                  />
                }
              />
              {/* Soft contact shadow that breathes with the float */}
              <m.div
                ref={shadowRef}
                aria-hidden
                animate={
                  shadowBreathing
                    ? { scaleX: [1, 0.9, 1], opacity: [0.35, 0.25, 0.35] }
                    : { scaleX: 1, opacity: 0.35 }
                }
                transition={
                  shadowBreathing ? { duration: 6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }
                }
                className="mx-auto mt-5 h-4 w-40 rounded-full bg-[radial-gradient(ellipse,rgba(29,23,18,0.5)_0%,transparent_70%)] sm:w-52"
              />
            </Reveal>
          </div>

          {/* Right callouts */}
          <Stagger
            className="order-3 grid grid-cols-2 gap-8 lg:grid-cols-1 lg:gap-14"
            step={STAGGER.loose}
            delay={0.08}
          >
            {TR.right.map((item) => (
              <StaggerItem key={item.name.EN}>
                <IngredientLabel item={item} language={language} align="left" animated={!reduced} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
