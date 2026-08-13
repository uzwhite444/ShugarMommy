import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion } from 'motion/react';
import { X, Send, Loader2 } from 'lucide-react';
import { LanguageCode, Localized, ServiceZone } from '../types';
import {
  calcTotal,
  formatPrice,
  getLocalized,
  MANAGER_TELEGRAM,
  priceFrom,
  STUDIO_NAME,
} from '../utils';
import { MASTERS, masterKey, toIsoDate } from '../data';
import { createBooking, formatBookingCode, warnOnPriceDrift } from '../lib/bookings';
import { fetchDayAvailability, isRangeTaken } from '../lib/availability';
import { getSource } from '../lib/attribution';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { BookingSummary } from './booking/BookingSummary';
import { BookingSuccess } from './booking/BookingSuccess';
import { StepContacts } from './booking/StepContacts';
import { StepMaster } from './booking/StepMaster';
import { StepSchedule } from './booking/StepSchedule';
import { useBookingSchedule } from './booking/useBookingSchedule';
import { buildDays, inputCls, INTL_LOCALE, setTitle } from './booking/bookingDisplay';
import { TR } from './booking/tr';

interface BookingModalProps {
  language: LanguageCode;
  selectedZones: ServiceZone[];
  onClose: () => void;
  /** Removes a zone straight from the summary chips. */
  onRemoveZone?: (zoneId: string) => void;
  /** Opens the self-service cancellation form, pre-filled with the code. */
  onCancelBooking?: (code?: string) => void;
  /** Master id, or '' for «любой мастер». Shared with the price list. */
  masterId: string;
  onChangeMaster: (masterId: string) => void;
}

/** Shortest bookable visit — one grid cell, even with no zones picked. */
const MIN_DURATION_MIN = 30;

export default function BookingModal({
  language,
  selectedZones,
  onClose,
  onRemoveZone,
  onCancelBooking,
  masterId,
  onChangeMaster,
}: BookingModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);
  const reduced = useReducedMotion();

  const doneHeadingRef = useRef<HTMLHeadingElement>(null);
  // Blocks a second tap from firing a parallel insert before React re-renders
  // the button as disabled.
  const submitLockRef = useRef(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The backdrop closes the dialog only when the press *started* on it —
  // otherwise releasing a text selection over the backdrop wipes the form.
  const overlayPressRef = useRef(false);

  // Lock the page behind the modal — without this the background scrolls
  // under the dialog on touch devices and the user loses their place.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Comes from App, so the master picked in the price list is already selected
  // here — and a change here is reflected back there. One choice, one number.
  const setMasterId = onChangeMaster;
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  // Kept after submit so the confirmation can offer a manual Telegram link +
  // copy button — the redirect is often blocked in in-app browsers (Instagram).
  const [requestMsg, setRequestMsg] = useState('');
  const [copied, setCopied] = useState(false);
  // Set after a successful save — powers the "remind me" deep link.
  const [bookingId, setBookingId] = useState<string | null>(null);
  // Snapshot of what was actually sent. The confirmation screen must repeat the
  // request, not re-derive it: the form's state keeps living behind the success
  // screen and a later reset would rewrite what the client believes she booked.
  const [placedInfo, setPlacedInfo] = useState<{
    master: string;
    when: string;
    total: string | null;
    set: string | null;
  } | null>(null);

  const t = (loc: Localized) => getLocalized(loc, language);

  // Face, brows and polymer zones are Рената's alone. A master who does not
  // perform every selected zone must not be bookable for this visit at all —
  // otherwise the studio receives a request nobody on that shift can carry out.
  // `selectedZones` is a fresh array on every parent render, so memoising on it
  // never hits. The ids are the real dependency — deriving them inside the memo
  // keeps that true AND honest to the dependency checker, which cannot see that
  // `zoneKey` already encodes the array.
  const zoneKey = selectedZones.map((z) => z.id).join('|');
  const eligibleMasters = useMemo(() => {
    const ids = zoneKey ? zoneKey.split('|') : [];
    return MASTERS.filter((master) => ids.every((id) => master.zoneIds.includes(id)));
  }, [zoneKey]);
  // Zones that make the choice narrower, named in the explanation below.
  const restrictedZones = selectedZones.filter(
    (zone) => !MASTERS.every((master) => master.zoneIds.includes(zone.id)),
  );
  // When one master is the only one who can do the work, she is not a choice —
  // she is the booking. "Любой мастер" would otherwise quote the lowest price
  // across the studio, which is a price only a master who cannot do these zones
  // charges, and would send the admin a visit to assign to nobody.
  const soleMaster = eligibleMasters.length === 1 ? eligibleMasters[0] : null;
  // MASTERS is already filtered — a hidden master can never be selected here,
  // and an unknown or now-ineligible id simply falls back to "любой мастер".
  const selectedMaster = soleMaster ?? eligibleMasters.find((m) => m.id === masterId);
  // What the picker shows as chosen: the forced master wins over stale state.
  const activeMasterId = selectedMaster?.id ?? '';

  // Push a forced master back to the shared state, so the price list behind the
  // modal quotes the same visit. Without this the two disagree on the same
  // basket: the list keeps the (now impossible) master and prints her cheaper
  // total, while the form books the only master who can actually do the work.
  useEffect(() => {
    if (soleMaster && soleMaster.id !== masterId) onChangeMaster(soleMaster.id);
  }, [soleMaster, masterId, onChangeMaster]);
  const calc = calcTotal(selectedZones, selectedMaster);
  // The number as it may be shown: without a master it is the lowest price of
  // the masters who could take the visit, so it has to read «от».
  const totalLabel = calc.priceVaries
    ? priceFrom(calc.total, language)
    : formatPrice(calc.total, language);
  /**
   * Masters this selection would already earn a percentage discount with —
   * shown only while no master is chosen, and always by name, because the
   * discount belongs to her and not to the studio. Mixed percentages are not
   * summarised: one line cannot state two different offers truthfully.
   */
  const discountOffers = selectedMaster
    ? []
    : eligibleMasters.flatMap((master) =>
        master.discount && calc.pricedZones.length >= master.discount.minZones
          ? [{ name: getLocalized(master.name, language), pct: master.discount.pct }]
          : [],
      );
  const discountHint =
    discountOffers.length > 0 && new Set(discountOffers.map((o) => o.pct)).size === 1
      ? { pct: discountOffers[0].pct, masters: discountOffers.map((o) => o.name).join(', ') }
      : null;
  const tgLink = `https://t.me/${MANAGER_TELEGRAM}?text=${encodeURIComponent(requestMsg)}`;

  const days = useMemo(() => buildDays(), []);
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[language], { weekday: 'short' }),
    [language],
  );

  // Canonical (RU) spelling — what the database stores, in every language.
  const selectedMasterName = selectedMaster ? masterKey(selectedMaster) : null;
  // How long the chair is actually occupied: "legs full + deep bikini" is 90
  // minutes, so it blocks three cells, not one.
  const comboDuration = Math.max(calc.durationMin, MIN_DURATION_MIN);

  const {
    availability,
    setAvailability,
    loadingSlots,
    workHours,
    rosterFor,
    slots,
    takenSet,
    tooLateSet,
    pastSet,
    allTaken,
    noHours,
  } = useBookingSchedule({
    date,
    setDate,
    time,
    setTime,
    selectedMaster,
    eligibleMasters,
    comboDuration,
    selectedMasterName,
  });

  // The form unmounts on success, so the focused control disappears and focus
  // would fall outside the dialog — move it onto the confirmation heading.
  useEffect(() => {
    if (placed) doneHeadingRef.current?.focus();
  }, [placed]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  /** Enter in a text field submits — the behaviour a <form> would give. */
  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    void handleSubmit();
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    // Last line of defence for the same rule the picker enforces: a request the
    // studio cannot carry out must not be sent, whatever state got us here.
    // (An empty selection leaves every master eligible, so this cannot fire on it.)
    if (eligibleMasters.length === 0) {
      setError(t(TR.errNoMaster));
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError(t(TR.errFill));
      return;
    }
    // Catch it here rather than let the database CHECK reject the row: a number
    // this short cannot be called back, so the booking is useless to both sides.
    if (phone.replace(/[^0-9]/g, '').length < 7) {
      setError(t(TR.errPhoneShort));
      return;
    }
    if (!date || !time) {
      setError(t(TR.errDate));
      return;
    }
    // The form may sit open long enough for the chosen time to pass — including
    // past midnight. The old check only ran when `date` was still today, so a
    // tab left open overnight skipped it entirely and sent the booking for a
    // time that had not merely passed but belonged to yesterday. Compare the
    // whole moment instead. (Bare `${date}T${time}` parses as LOCAL time, which
    // is what we want: the client and the studio share Asia/Tashkent.)
    if (new Date(`${date}T${time}:00`).getTime() <= Date.now()) {
      setTime('');
      // The date itself is stale after midnight, so clear it too — otherwise
      // the grid re-opens on a day that is over.
      if (date !== toIsoDate(new Date())) setDate('');
      setError(t(TR.errPast));
      return;
    }
    // Everything below awaits the network, so take the lock and disable the
    // button *before* the first await — a double-tap would otherwise insert twice.
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      // Someone may have taken the slot while the form was open.
      const fresh = await fetchDayAvailability(date);
      // Same per-slot roster the grid used: with the day-level one this recheck
      // agreed with a grid that was already wrong and let the booking through.
      const slotRoster = rosterFor(time);
      if (
        (!selectedMasterName && slotRoster.length === 0) ||
        isRangeTaken(fresh, time, selectedMasterName, comboDuration, slotRoster)
      ) {
        setAvailability(fresh);
        setTime('');
        setError(t(TR.errTaken));
        return;
      }
      setError('');

      const master = selectedMaster;
      const masterName = master ? getLocalized(master.name, language) : t(TR.anyMaster);
      const servicesText =
        selectedZones.length > 0
          ? selectedZones.map((z) => getLocalized(z.name, language)).join(', ')
          : t(TR.noZones);

      const greeting =
        language === 'RU'
          ? `✨ Здравствуйте, ${STUDIO_NAME}!\nХочу записаться на шугаринг:`
          : language === 'UZ'
            ? `✨ Assalomu alaykum, ${STUDIO_NAME}!\nShugaringga yozilmoqchiman:`
            : `✨ Hello, ${STUDIO_NAME}!\nI would like to book a sugaring session:`;

      const labels =
        language === 'RU'
          ? { services: 'Зоны', master: 'Мастер', date: 'Дата', time: 'Время', total: 'Итого', onRequest: 'Цена по запросу', name: 'Имя', phone: 'Телефон', comment: 'Комментарий', code: 'Код записи' }
          : language === 'UZ'
            ? { services: 'Zonalar', master: 'Usta', date: 'Sana', time: 'Vaqt', total: 'Jami', onRequest: 'Narx so‘rov bo‘yicha', name: 'Ism', phone: 'Telefon', comment: 'Izoh', code: 'Yozuv kodi' }
            : { services: 'Zones', master: 'Master', date: 'Date', time: 'Time', total: 'Total', onRequest: 'Price on request', name: 'Name', phone: 'Phone', comment: 'Comment', code: 'Booking code' };

      const setText = calc.appliedSet ? setTitle(calc.appliedSet, language) : null;

      let message = `${greeting}\n\n`;
      message += `💆‍♀️ ${labels.services}: ${servicesText}\n`;
      message += `👩‍🔬 ${labels.master}: ${masterName}\n`;
      message += `📅 ${labels.date}: ${date}\n`;
      message += `🕐 ${labels.time}: ${time}\n`;
      // The total covers priced zones only — quoting it while an unpriced zone
      // is in the list would understate what the studio actually charges, so
      // those zones are named separately instead of being folded in silently.
      // `totalLabel` already carries «от» when no master is picked and her
      // choice would move the price.
      if (calc.pricedZones.length > 0) {
        const discountNote =
          calc.discountPct > 0 ? ` (${t(TR.comboDiscount)} −${calc.discountPct}%)` : '';
        message += `💰 ${labels.total}: ${totalLabel}${discountNote}\n`;
      }
      // Named, not just priced: the administrator has to see which offer the
      // total came from, or the fixed set price looks like an arithmetic error.
      if (setText) {
        const saving =
          calc.setSavings > 0
            ? ` · ${t(TR.setSaving).replace('{sum}', formatPrice(calc.setSavings, language))}`
            : '';
        message += `🎁 ${t(TR.setApplied)}: ${setText}${saving}\n`;
      }
      if (calc.onRequestZones.length > 0) {
        const onRequestText = calc.onRequestZones
          .map((z) => getLocalized(z.name, language))
          .join(', ');
        message += `❓ ${labels.onRequest}: ${onRequestText}\n`;
      }
      message += `\n👤 ${labels.name}: ${name.trim()}\n📞 ${labels.phone}: ${phone.trim()}`;
      if (comment.trim()) message += `\n💬 ${labels.comment}: ${comment.trim()}`;

      // Persist to the backend. `master` must stay the canonical RU spelling —
      // availability matching, the admin panel AND the server-side price list
      // all key on it. The total and the visit length are deliberately absent:
      // the database derives both from `zone_ids` and this master, so a request
      // forged with a price of 0 buys nothing but the studio's real price.
      const result = await createBooking({
        customer_name: name.trim(),
        phone: phone.trim(),
        services: servicesText,
        master: master ? masterKey(master) : null,
        visit_date: date,
        visit_time: time,
        zone_ids: selectedZones.map((z) => z.id),
        comment: comment.trim() || null,
        source: getSource(),
      });
      // Both sides compute from src/data.ts, so they agree — unless the copy in
      // the database was never refreshed. That is worth a console error.
      warnOnPriceDrift(calc.total, result);

      // The database rejected the booking — showing the success screen would
      // send the client away believing she is booked.
      if (result.status === 'slot-taken') {
        setAvailability(await fetchDayAvailability(date));
        setTime('');
        setError(t(TR.errTaken));
        return;
      }
      if (result.status === 'rate-limited') {
        setError(t(TR.errTooMany));
        return;
      }
      if (result.status === 'invalid') {
        setError(t(TR.errPhoneShort));
        return;
      }
      // 'unavailable' still goes through: a backend outage must never cost the
      // studio a client, the request reaches the administrator via Telegram.

      const savedId = result.status === 'ok' ? result.id : null;
      // The code travels with the request itself, so it ends up in her own
      // Telegram thread with the studio — the place she will actually look
      // for it days later, when this screen is long gone.
      const code = formatBookingCode(savedId);
      if (code) message += `\n\n🔑 ${labels.code}: ${code}`;

      setBookingId(savedId);
      setRequestMsg(message);
      setPlacedInfo({
        master: masterName,
        when: `${date} · ${time}`,
        total: calc.pricedZones.length > 0 ? totalLabel : null,
        set: setText,
      });
      setPlaced(true);

      // window.open('_blank') is often blocked inside in-app browsers, so we
      // also keep the manual link + copy fallback on the confirmation screen.
      const link = `https://t.me/${MANAGER_TELEGRAM}?text=${encodeURIComponent(message)}`;
      window.open(link, '_blank', 'noopener');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestMsg);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the manual Telegram link still works.
    }
  };

  return createPortal(
    /* The backdrop is a dimming layer, not a control: it takes no focus, so a
       keyboard handler on it could never fire. Keyboard dismissal is Escape
       (useFocusTrap) plus the labelled Close button inside the dialog. */
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onPointerDown={(e) => {
        overlayPressRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (overlayPressRef.current && e.target === e.currentTarget) onClose();
        overlayPressRef.current = false;
      }}
    >
      {/* iOS Safari resolves vh against the LARGE viewport while the fixed
          overlay matches the small one, pushing the sheet off-screen. The
          inline dvh wins where supported and is ignored where it is not,
          leaving max-h-[92vh] as the fallback. */}
      <m.div
        ref={panelRef}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 32 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={t(TR.title)}
        style={{ maxHeight: '92dvh' }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-canvas p-6 shadow-2xl sm:rounded-2xl sm:p-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display text-3xl text-ink">{t(TR.title)}</h2>
          <button
            onClick={onClose}
            aria-label={t(TR.close)}
            className="press-inner -mr-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink"
          >
            <X size={22} />
          </button>
        </div>

        {placed ? (
          <BookingSuccess
            t={t}
            doneHeadingRef={doneHeadingRef}
            placedInfo={placedInfo}
            bookingId={bookingId}
            tgLink={tgLink}
            copied={copied}
            onCopy={handleCopy}
            onCancelBooking={onCancelBooking}
          />
        ) : (
          <>
            <BookingSummary
              language={language}
              selectedZones={selectedZones}
              onRemoveZone={onRemoveZone}
              calc={calc}
              totalLabel={totalLabel}
              discountHint={discountHint}
              t={t}
            />

            <div className="space-y-6">
              <StepContacts
                t={t}
                name={name}
                setName={setName}
                phone={phone}
                setPhone={setPhone}
                onFieldKeyDown={onFieldKeyDown}
              />

              <StepMaster
                t={t}
                language={language}
                activeMasterId={activeMasterId}
                soleMaster={soleMaster}
                eligibleMasters={eligibleMasters}
                restrictedZones={restrictedZones}
                setMasterId={setMasterId}
              />

              <StepSchedule
                t={t}
                days={days}
                weekdayFmt={weekdayFmt}
                date={date}
                setDate={setDate}
                selectedMaster={selectedMaster}
                eligibleMasters={eligibleMasters}
                workHours={workHours}
                loadingSlots={loadingSlots}
                availability={availability}
                noHours={noHours}
                allTaken={allTaken}
                slots={slots}
                takenSet={takenSet}
                pastSet={pastSet}
                tooLateSet={tooLateSet}
                time={time}
                setTime={setTime}
                comboDuration={comboDuration}
              />

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t(TR.comment)}
                aria-label={t(TR.comment)}
                rows={2}
                maxLength={1000}
                className={`${inputCls} resize-none`}
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-danger">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-press press-slab mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {t(TR.submit)}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">{t(TR.disclaimer)}</p>
            <p className="mt-2 text-center text-xs leading-relaxed text-faint">
              {t(TR.consentPre)}{' '}
              <a
                href="#/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-muted"
              >
                {t(TR.consentLink)}
              </a>
              .
            </p>
          </>
        )}
      </m.div>
    </div>,
    document.body,
  );
}
