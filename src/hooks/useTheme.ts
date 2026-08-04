import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'shugarmommy-theme';

function readStored(): Theme | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'dark' || raw === 'light' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Light/dark theme with an explicit visitor choice, remembered across visits.
 * The warm cream palette is the brand, so first-time visitors always see it —
 * dark mode is opt-in rather than inherited from the OS. The switch runs
 * inside a View Transition where supported, so it cross-fades.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#17120E' : '#FAF7F2');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const apply = () => {
      setTheme((prev) => {
        const next: Theme = prev === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Storage blocked — the theme just won't persist.
        }
        return next;
      });
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (!reduced && typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(apply);
    } else {
      apply();
    }
  }, []);

  return { theme, toggleTheme };
}
