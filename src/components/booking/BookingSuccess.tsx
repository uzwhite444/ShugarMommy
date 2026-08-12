import { RefObject } from 'react';
import { BellRing, Check, CheckCircle2, Copy, KeyRound, Send } from 'lucide-react';
import { Localized } from '../../types';
import { MANAGER_BOT } from '../../utils';
import { formatBookingCode, normalizeBookingCode } from '../../lib/bookings';
import { TR } from './tr';

interface PlacedInfo {
  master: string;
  when: string;
  total: string | null;
  set: string | null;
}

interface BookingSuccessProps {
  t: (loc: Localized) => string;
  doneHeadingRef: RefObject<HTMLHeadingElement | null>;
  placedInfo: PlacedInfo | null;
  bookingId: string | null;
  tgLink: string;
  copied: boolean;
  onCopy: () => void;
  /** Opens the cancellation form, pre-filled with this booking's code. */
  onCancelBooking?: (code?: string) => void;
}

/** Confirmation screen: booking code, Telegram handoff, copy, reminder deep link, cancel link. */
export function BookingSuccess({
  t,
  doneHeadingRef,
  placedInfo,
  bookingId,
  tgLink,
  copied,
  onCopy,
  onCancelBooking,
}: BookingSuccessProps) {
  // The code is the first 8 characters of the id, so it exists exactly when the
  // booking reached the database — same condition as the reminder deep link.
  const code = formatBookingCode(bookingId);

  return (
    <div className="text-center">
      {/* Scoped to the confirmation copy — a live region around the whole
          screen would read out every button below it too. */}
      <div role="status">
        <CheckCircle2 size={56} className="mx-auto text-success" />
        <h3 ref={doneHeadingRef} tabIndex={-1} className="display mt-4 text-2xl text-ink outline-none">
          {t(TR.doneTitle)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(TR.doneText)}</p>
      </div>

      {/* Repeat of the request as sent — same master, same total, same
          offer, so the confirmation cannot say something the Telegram
          message does not. */}
      {placedInfo && (
        <dl className="mt-5 space-y-2 rounded-xl bg-surface p-5 text-left text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">{t(TR.stepMaster)}</dt>
            <dd className="text-right font-medium text-ink">{placedInfo.master}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">{t(TR.stepWhen)}</dt>
            <dd className="text-right font-medium text-ink">{placedInfo.when}</dd>
          </div>
          {placedInfo.set && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">{t(TR.setApplied)}</dt>
              <dd className="text-right font-medium text-primary-dark">{placedInfo.set}</dd>
            </div>
          )}
          {placedInfo.total && (
            <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-2">
              <dt className="text-muted">{t(TR.total)}</dt>
              <dd className="text-right font-semibold text-ink">{placedInfo.total}</dd>
            </div>
          )}
        </dl>
      )}

      {/* The one thing on this screen she has to keep: without the code the
          booking can only be cancelled by phoning the studio. */}
      {code && (
        <div className="mt-5 rounded-xl border border-primary/30 bg-surface p-5 text-left">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <KeyRound size={13} /> {t(TR.codeTitle)}
          </p>
          <p className="mt-1.5 select-all font-mono text-2xl font-semibold tracking-[0.18em] text-ink">
            {code}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{t(TR.codeHint)}</p>
        </div>
      )}

      {/* Opt-in reminder: works only when the booking reached the base,
          since the deep link carries its id. */}
      {bookingId && (
        <div className="mt-5 rounded-xl bg-surface p-5 text-left">
          <p className="text-sm font-semibold text-ink">{t(TR.remindTitle)}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">{t(TR.remindText)}</p>
          <a
            href={`https://t.me/${MANAGER_BOT}?start=${bookingId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press ink-rule rule-slab mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ink/20 px-5 py-3 text-sm font-semibold text-ink hover:border-ink"
          >
            <BellRing size={16} /> {t(TR.remindBtn)}
          </a>
        </div>
      )}
      <div className="mt-6 space-y-3">
        <a
          href={tgLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press press-slab flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          <Send size={18} /> {t(TR.openTg)}
        </a>
        <button
          onClick={onCopy}
          className="btn-press ink-rule rule-slab flex w-full items-center justify-center gap-2 rounded-lg border border-hairline px-5 py-3.5 text-sm font-semibold text-ink hover:border-ink"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? t(TR.copied) : t(TR.copyMsg)}
        </button>
      </div>
      {/* The button's own label change is not announced — this is. */}
      <p aria-live="polite" className="sr-only">
        {copied ? t(TR.copied) : ''}
      </p>
      {onCancelBooking && (
        <p className="mt-6 border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
          {t(TR.changedMind)}{' '}
          {/* One tap: the form opens with the code already filled in, so all
              she types is the phone she booked with. */}
          <button
            onClick={() => onCancelBooking(normalizeBookingCode(bookingId ?? ''))}
            className="btn-press ink-rule rule-link rule-short font-semibold text-primary-dark"
          >
            {t(TR.cancelLink)}
          </button>
        </p>
      )}
    </div>
  );
}
