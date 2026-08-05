import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { LanguageCode } from '../types';
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

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const hero = document.getElementById('top');
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
      // Show after the hero leaves, hide again at the very bottom where the
      // contact block already carries its own call to action.
      const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 420;
      setVisible(heroBottom < 0 && !nearBottom);
    };

    // One passive handler for both events, and layout is read at most once
    // per frame instead of on every scroll tick.
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && !hidden && (
        <m.div
          initial={{ y: '120%' }}
          animate={{ y: 0 }}
          exit={{ y: '120%' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm lg:hidden"
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
              className="btn-press shrink-0 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              {getLocalized(TR.book, language)}
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
