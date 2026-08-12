import { X } from 'lucide-react';
import { CalcResult, formatPrice, getLocalized, PRICE_ON_REQUEST } from '../../utils';
import { Localized, LanguageCode, ServiceZone } from '../../types';
import { setTitle } from './bookingDisplay';
import { TR } from './tr';

interface BookingSummaryProps {
  language: LanguageCode;
  selectedZones: ServiceZone[];
  onRemoveZone?: (zoneId: string) => void;
  calc: CalcResult;
  totalLabel: string;
  discountHint: { pct: number; masters: string } | null;
  t: (loc: Localized) => string;
}

/** Selected zones — removable chips + running total (the booking receipt). */
export function BookingSummary({
  language,
  selectedZones,
  onRemoveZone,
  calc,
  totalLabel,
  discountHint,
  t,
}: BookingSummaryProps) {
  return (
    <div className="mb-6 rounded-xl bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(TR.yourCombo)}</p>
      {selectedZones.length > 0 ? (
        <>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {selectedZones.map((zone) => (
              <li key={zone.id}>
                {onRemoveZone ? (
                  /* The button is the 44px touch target; the inner span
                     keeps the chip visually small. */
                  <button
                    onClick={() => onRemoveZone(zone.id)}
                    aria-label={`${t(TR.removeZone)}: ${getLocalized(zone.name, language)}`}
                    className="group press-inner flex min-h-11 min-w-11 items-center"
                  >
                    <span className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-canvas py-1 pl-3 pr-2 text-xs font-medium text-body transition-colors group-hover:border-danger/40 group-hover:text-danger">
                      {getLocalized(zone.name, language)}
                      <X size={12} className="text-faint transition-colors group-hover:text-danger" />
                    </span>
                  </button>
                ) : (
                  <span className="block rounded-full border border-ink/15 bg-canvas px-3 py-1 text-xs font-medium text-body">
                    {getLocalized(zone.name, language)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {/* Zones the studio has not priced yet stay out of the sum —
              showing them inside it would quote a total that is wrong. */}
          <p className="mt-3 border-t border-ink/10 pt-3 font-serif text-xl font-semibold text-ink">
            {t(TR.total)}: {calc.pricedZones.length > 0 ? totalLabel : t(PRICE_ON_REQUEST)}
          </p>
          {/* Set and percentage are different offers and never both
              apply: only Рената has sets, and she gives no percentage. */}
          {calc.appliedSet && (
            <p className="mt-1 font-sans text-xs font-semibold text-primary-dark">
              {t(TR.setApplied)}: {setTitle(calc.appliedSet, language)}
              {calc.setSavings > 0 &&
                ` · ${t(TR.setSaving).replace('{sum}', formatPrice(calc.setSavings, language))}`}
            </p>
          )}
          {calc.discountPct > 0 && (
            <p className="mt-1 font-sans text-xs font-semibold text-primary-dark">
              {t(TR.comboDiscount)} −{calc.discountPct}%
            </p>
          )}
          {/* Before a master is chosen the discount is hers, not the
              studio's — so it is offered by name and never applied. */}
          {discountHint && (
            <p className="mt-1 font-sans text-xs font-medium text-muted">
              {t(TR.discountWith)
                .replace('{pct}', String(discountHint.pct))
                .replace('{masters}', discountHint.masters)}
            </p>
          )}
          {calc.priceVaries && (
            <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">
              {t(TR.variesNote)}
            </p>
          )}
          {calc.onRequestZones.length > 0 && (
            <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">
              {t(TR.onRequestLead)}{' '}
              <span className="font-semibold text-body">
                {calc.onRequestZones.map((z) => getLocalized(z.name, language)).join(', ')}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">{t(TR.noZones)}</p>
      )}
    </div>
  );
}
