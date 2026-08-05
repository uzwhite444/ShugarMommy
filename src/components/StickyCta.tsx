import { useEffect, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { LanguageCode } from '../types';
import { EASE_INK } from '../lib/motion';
import { subscribeScroll } from '../lib/scrollState';
import { formatPrice, getLocalized } from '../utils';

interface StickyCtaProps {
  language: LanguageCode;
  /** Total of the currently selected zones, 0 when nothing is picked. */
  total: number;
  zoneCount: number;
  onBook: () => void;
  /** Hidden while any modal is open. */
  hidden: boolean;
}

/** Distance from the document bottom at which the contact block takes over. */
const NEAR_BOTTOM = 420;

const TR = {
  book: { RU: 'Записаться', UZ: 'Yozilish', EN: 'Book now' },
  hint: { RU: 'Онлайн-запись за минуту', UZ: 'Bir daqiqada yozilish', EN: 'Book online in a minute' },
};

/** "1 зона · 2 зоны · 5 зон" — Russian needs real pluralisation. */
function zonesLabel(count: number, language: LanguageCode): string {
  if (language === 'UZ') return `${count} ta zona tanlandi`;
  if (language === 'EN') return `${count} ${count === 1 ? 'zone' : 'zones'} picked`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'зона'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'зоны'
        : 'зон';
  const verb = mod10 === 1 && mod100 !== 11 ? 'выбрана' : 'выбрано';
  return `${count} ${word} ${verb}`;
}

/**
 * Mobile-only action bar that appears once the hero scrolls away, so the
 * booking button is always one thumb-tap away. Mirrors the calculator total
 * when zones are selected.
 */
export default function StickyCta({ language, total, zoneCount, onBook, hidden }: StickyCtaProps) {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  // The bar is `lg:hidden`, so above 1024px it can never appear — and the old
  // effect still ran its whole measure loop there, two forced reflows per frame
  // (a getBoundingClientRect plus a body.scrollHeight read), 100% wasted on
  // every desktop session. Nothing is measured unless the bar could be shown.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');

    let stop: (() => void) | undefined;
    const sync = () => {
      stop?.();
      stop = undefined;
      if (desktop.matches) {
        setVisible(false);
        return;
      }
      stop = subscribeScroll(({ y, vh }) => {
        const hero = document.getElementById('top');
        const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
        // Show after the hero leaves, hide again at the very bottom where the
        // contact block already carries its own call to action.
        const nearBottom = vh + y > document.body.scrollHeight - NEAR_BOTTOM;
        setVisible(heroBottom < 0 && !nearBottom);
      });
    };

    sync();
    desktop.addEventListener('change', sync);
    return () => {
      stop?.();
      desktop.removeEventListener('change', sync);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && !hidden && (
        <m.div
          // A full bar-height slide fired for every reduced-motion visitor,
          // while the bar's own hairline was correctly frozen by the CSS block
          // — the rule held still and the thing it belongs to slid.
          initial={reduced ? false : { y: '120%' }}
          animate={reduced ? undefined : { y: 0 }}
          exit={reduced ? undefined : { y: '120%' }}
          transition={{ duration: 0.35, ease: EASE_INK }}
          // The bar lands first, then its top hairline inks across — the border
          // is the sig-rule now, so it must not also be a border utility.
          className="sig-rule sig-rule-top sig-rule-once fixed inset-x-0 bottom-0 z-40 bg-canvas/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm lg:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {zoneCount > 0 ? (
                <>
                  <p className="truncate text-xs text-muted">{zonesLabel(zoneCount, language)}</p>
                  <p className="font-serif text-lg font-semibold leading-tight text-ink">
                    {formatPrice(total, language)}
                  </p>
                </>
              ) : (
                <p className="text-xs leading-snug text-muted">{getLocalized(TR.hint, language)}</p>
              )}
            </div>
            <button
              onClick={onBook}
              className="btn-press press-slab shrink-0 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              {getLocalized(TR.book, language)}
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
