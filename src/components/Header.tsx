import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalized } from '../utils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  onBook: () => void;
}

const NAV_ITEMS = [
  { href: '#services', label: { RU: 'Услуги и цены', UZ: 'Xizmatlar', EN: 'Services' } },
  { href: '#process', label: { RU: 'Как проходит', UZ: 'Jarayon', EN: 'Process' } },
  { href: '#masters', label: { RU: 'Мастера', UZ: 'Ustalar', EN: 'Masters' } },
  { href: '#promos', label: { RU: 'Акции', UZ: 'Aksiyalar', EN: 'Offers' } },
  { href: '#reviews', label: { RU: 'Отзывы', UZ: 'Fikrlar', EN: 'Reviews' } },
  { href: '#contacts', label: { RU: 'Контакты', UZ: 'Aloqa', EN: 'Contacts' } },
];

const LANGS: LanguageCode[] = ['RU', 'UZ', 'EN'];

const BOOK_LABEL = { RU: 'Записаться', UZ: 'Yozilish', EN: 'Book now' };

const MENU_LABEL = { RU: 'Меню', UZ: 'Menyu', EN: 'Menu' };

const THEME_LABEL = {
  RU: 'Сменить тему',
  UZ: 'Mavzuni almashtirish',
  EN: 'Switch theme',
};

/** Wordmark: quiet serif with a single terracotta full stop. */
function Wordmark() {
  return (
    <span className="font-serif text-[22px] font-semibold tracking-tight text-ink">
      Shugar Mommy<span className="text-primary">.</span>
    </span>
  );
}

export default function Header({ language, onChangeLanguage, onBook }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const { theme, toggleTheme } = useTheme();

  // The reveal grows from the button box, not from the pointer: keyboard
  // activation carries no usable coordinates.
  const onToggleTheme = () => {
    const rect = themeBtnRef.current?.getBoundingClientRect();
    toggleTheme(rect && { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  // Dialog semantics for the mobile menu: focus trap + Escape to close.
  useFocusTrap(menuRef, menuOpen, () => setMenuOpen(false));

  // Hide the bar while scrolling down, bring it back on any scroll up —
  // content gets the full viewport, the CTA is one flick away.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      // Never retract the bar while it holds keyboard focus: going inert would
      // blur the focused control and drop the user back to the document root.
      const holdsFocus = headerRef.current?.contains(document.activeElement) ?? false;
      setHidden(!holdsFocus && y > 140 && y > lastY);
      lastY = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // The overlay is lg:hidden; if the viewport crosses the lg breakpoint while
  // it is open (tablet rotation, window resize) the menu vanishes but the body
  // scroll-lock would stay — so close it in sync with the CSS breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <header
      ref={headerRef}
      // A retracted bar is only translated off-screen, so its links stay in the
      // tab order: make it inert while hidden, and reveal it again if focus
      // still lands inside (browsers without inert support).
      inert={hidden && !menuOpen}
      onFocus={() => setHidden(false)}
      className={`fixed inset-x-0 top-0 z-40 bg-canvas/95 backdrop-blur-sm transition-[transform,border-color] duration-300 ease-out motion-reduce:transition-none ${
        scrolled ? 'border-b border-hairline' : 'border-b border-transparent'
      } ${hidden && !menuOpen ? '-translate-y-full' : 'translate-y-0'}`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" aria-label="Shugar Mommy" className="flex min-h-11 items-center">
          <Wordmark />
        </a>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="nav-underline text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {getLocalized(item.label, language)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center sm:flex" role="group" aria-label="Language">
            {LANGS.map((lang, i) => (
              <Fragment key={lang}>
                {/* Standalone rule: the 44px hit area would stretch a border on
                    the button into a full-height divider. */}
                {i > 0 && <span aria-hidden className="h-4 w-px shrink-0 bg-hairline" />}
                <button
                  onClick={() => onChangeLanguage(lang)}
                  aria-pressed={language === lang}
                  className={`flex min-h-11 min-w-11 items-center justify-center text-xs font-semibold transition-colors ${
                    language === lang ? 'text-ink underline decoration-primary decoration-2 underline-offset-4' : 'text-faint hover:text-ink'
                  }`}
                >
                  {lang}
                </button>
              </Fragment>
            ))}
          </div>
          <button
            ref={themeBtnRef}
            onClick={onToggleTheme}
            aria-label={getLocalized(THEME_LABEL, language)}
            title={getLocalized(THEME_LABEL, language)}
            className="btn-press flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink"
          >
            <span aria-hidden className="theme-icon">
              <span className={`theme-icon-face${theme === 'dark' ? ' is-on' : ''}`}>
                <Sun size={18} />
              </span>
              <span className={`theme-icon-face${theme === 'dark' ? '' : ' is-on'}`}>
                <Moon size={18} />
              </span>
            </span>
          </button>
          <button
            onClick={onBook}
            className="btn-press hidden rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark sm:block"
          >
            {getLocalized(BOOK_LABEL, language)}
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label={getLocalized(MENU_LABEL, language)}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink lg:hidden"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Portalled to <body>: the header's backdrop-blur creates a containing
          block, which would trap this fixed overlay inside the 64px bar and
          make its links unclickable. */}
      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label={getLocalized(MENU_LABEL, language)}
            className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-canvas pb-6 text-ink lg:hidden"
          >
            <div className="flex h-16 items-center justify-between border-b border-hairline px-4">
              <Wordmark />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
              >
                <X size={22} />
              </button>
            </div>
            {/* Compact rhythm so the CTA still fits on short phones (568px). */}
            <nav aria-label="Mobile navigation" className="flex flex-col px-6 pt-3">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-hairline py-3 font-serif text-xl font-medium text-ink sm:py-4 sm:text-2xl"
                >
                  {getLocalized(item.label, language)}
                </a>
              ))}
            </nav>
            <div className="mt-5 flex items-center gap-2 px-6">
              {LANGS.map((lang) => (
                <button
                  key={lang}
                  onClick={() => onChangeLanguage(lang)}
                  aria-pressed={language === lang}
                  className={`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                    language === lang ? 'border-ink bg-ink text-canvas' : 'border-hairline text-muted'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="px-6 pt-5">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onBook();
                }}
                className="w-full rounded-lg bg-primary px-5 py-3.5 font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                {getLocalized(BOOK_LABEL, language)}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
