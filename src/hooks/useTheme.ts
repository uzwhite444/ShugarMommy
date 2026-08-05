import { useCallback, useEffect, useRef, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Viewport coordinates the reveal circle grows from. */
export interface RevealOrigin {
  x: number;
  y: number;
}

const KEY = 'shugarmommy-theme';

/** Marks the root while a theme switch is in flight. The reveal CSS hangs off
 *  this attribute rather than off `:active-view-transition-type()`, which older
 *  Chromium WebViews (in-app browsers) do not understand yet — they support
 *  view transitions but not types, and would otherwise fall back to the plain
 *  cross-fade the language switch uses. */
const VT_ATTR = 'data-theme-vt';

function readStored(): Theme | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'dark' || raw === 'light' ? raw : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#17120E' : '#FAF7F2');
}

/** View-transition pseudo-elements inherit custom properties from the root
 *  element — that is the only channel for handing them the click origin. */
function setRevealOrigin(origin: RevealOrigin | undefined) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const x = origin?.x ?? w / 2;
  const y = origin?.y ?? h / 2;
  const style = document.documentElement.style;
  style.setProperty('--theme-x', `${Math.round(x)}px`);
  style.setProperty('--theme-y', `${Math.round(y)}px`);
  // Distance to the farthest viewport corner: the circle must clear it to
  // cover the page, whichever corner the toggle sits closest to.
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  style.setProperty('--theme-r', `${Math.ceil(radius)}px`);
}

/**
 * Light/dark theme with an explicit visitor choice, remembered across visits.
 * The warm cream palette is the brand, so first-time visitors always see it —
 * dark mode is opt-in rather than inherited from the OS. The switch runs inside
 * a View Transition where supported: the new palette is revealed by a circle
 * growing out of the toggle button. Without View Transitions, or with reduced
 * motion, it just flips instantly.
 */
export function useTheme(): { theme: Theme; toggleTheme: (origin?: RevealOrigin) => void } {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? 'light');
  const themeRef = useRef(theme);
  const transitionRef = useRef<ViewTransition | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback((origin?: RevealOrigin) => {
    const next: Theme = themeRef.current === 'dark' ? 'light' : 'dark';
    themeRef.current = next;

    const update = () => {
      // Written to the DOM here rather than left to the effect above: a passive
      // effect lands after the browser has already captured the post-update
      // frame, so the transition would animate two identical snapshots.
      applyTheme(next);
      setTheme(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Storage blocked — the theme just won't persist.
      }
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // lib.dom types this as always present; older engines really do lack it.
    if (reduced || typeof document.startViewTransition !== 'function') {
      update();
      return;
    }

    // A press landing mid-reveal cuts the running one short instead of queueing
    // behind it: the DOM is already consistent, only the animation is dropped.
    transitionRef.current?.skipTransition();

    setRevealOrigin(origin);
    const root = document.documentElement;
    root.setAttribute(VT_ATTR, '');

    const transition = document.startViewTransition(update);
    transitionRef.current = transition;
    // `types` is undefined before Chromium 125 — declared so the theme change
    // stays a distinct transition type from the language cross-fade.
    transition.types?.add('theme');
    void transition.finished.finally(() => {
      // A newer press already owns the root: leave its attribute alone.
      if (transitionRef.current !== transition) return;
      transitionRef.current = null;
      root.removeAttribute(VT_ATTR);
    });
  }, []);

  return { theme, toggleTheme };
}
