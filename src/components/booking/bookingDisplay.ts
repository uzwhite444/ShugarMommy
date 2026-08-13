/** Small display-only helpers shared across the booking modal's steps. */
import { LanguageCode, ServiceSet } from '../../types';
import { findZone } from '../../data';
import { getLocalized } from '../../utils';

/**
 * A set's title, composed from its zone names — ServiceSet carries no name of
 * its own, so the card can never drift from the price list (and is translated
 * for free).
 */
export function setTitle(set: ServiceSet, lang: LanguageCode): string {
  return set.zoneIds
    .map((id) => {
      const zone = findZone(id);
      return zone ? getLocalized(zone.name, lang) : id;
    })
    .join(' + ');
}

/** Next `count` days starting today, as local dates. */
export function buildDays(count = 14): Date[] {
  const today = new Date();
  return Array.from(
    { length: count },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
  );
}

export const INTL_LOCALE: Record<LanguageCode, string> = { RU: 'ru-RU', UZ: 'uz-Latn-UZ', EN: 'en-US' };

/** Shared text-field style for the modal's inputs and textarea. */
export const inputCls =
  'field w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-primary';
