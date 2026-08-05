import { useRef } from 'react';
import { m, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react';
import Reveal from './ui/Reveal';
import LiquidVideo from './ui/LiquidVideo';
import { LanguageCode, Localized } from '../types';
import { getLocalized } from '../utils';
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

function IngredientLabel({ item, language, align }: { item: Ingredient; language: LanguageCode; align: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'lg:text-right' : ''}>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink">{getLocalized(item.name, language)}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{getLocalized(item.note, language)}</p>
      <span
        aria-hidden
        className={`mt-3 block h-px w-10 bg-primary ${align === 'right' ? 'lg:ml-auto' : ''}`}
      />
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
  const sectionRef = useRef<HTMLElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  // Slow scroll parallax so the object feels detached from the page plane.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const objectY = useTransform(scrollYProgress, [0, 1], [28, -28]);

  // The breathing shadow is the only endless loop on the page — it must not
  // keep the compositor busy while the section sits offscreen.
  const shadowInView = useInView(shadowRef, { margin: '-10% 0px' });
  const shadowBreathing = !reduced && shadowInView;

  return (
    <section ref={sectionRef} id="ingredients" className="overflow-hidden px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            {getLocalized(TR.subtitle, language)}
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-14">
          {/* Left callouts */}
          <div className="order-2 grid grid-cols-2 gap-8 lg:order-1 lg:grid-cols-1 lg:gap-14 lg:justify-items-end">
            {TR.left.map((item, i) => (
              <Reveal key={item.name.EN} delay={0.1 + i * 0.08}>
                <IngredientLabel item={item} language={language} align="right" />
              </Reveal>
            ))}
          </div>

          {/* The object */}
          <div id="paste-anchor" className="order-1 justify-self-center lg:order-2">
            <m.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
              whileInView={
                reduced ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' }
              }
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              style={reduced ? undefined : { y: objectY }}
            >
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
            </m.div>
          </div>

          {/* Right callouts */}
          <div className="order-3 grid grid-cols-2 gap-8 lg:grid-cols-1 lg:gap-14">
            {TR.right.map((item, i) => (
              <Reveal key={item.name.EN} delay={0.15 + i * 0.08}>
                <IngredientLabel item={item} language={language} align="left" />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
