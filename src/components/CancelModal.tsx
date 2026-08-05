import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion } from 'motion/react';
import { CheckCircle2, Loader2, Phone, Send, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalized, MANAGER_TELEGRAM, PHONE } from '../utils';
import { cancelBookingByPhone } from '../lib/bookings';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface CancelModalProps {
  language: LanguageCode;
  onClose: () => void;
}

const TR = {
  title: { RU: 'Отменить запись', UZ: 'Yozuvni bekor qilish', EN: 'Cancel a booking' },
  intro: {
    RU: 'Укажите телефон, который вы оставляли при записи, и дату визита — мы освободим это время.',
    UZ: 'Yozilishda qoldirgan telefoningizni va tashrif sanasini kiriting — vaqtni bo‘shatamiz.',
    EN: 'Enter the phone you booked with and the visit date — we will free the slot.',
  },
  phone: { RU: 'Телефон', UZ: 'Telefon', EN: 'Phone' },
  date: { RU: 'Дата визита', UZ: 'Tashrif sanasi', EN: 'Visit date' },
  submit: { RU: 'Отменить запись', UZ: 'Bekor qilish', EN: 'Cancel booking' },
  errFill: {
    RU: 'Укажите телефон и дату визита.',
    UZ: 'Telefon va tashrif sanasini kiriting.',
    EN: 'Please enter the phone and the visit date.',
  },
  notFound: {
    RU: 'Активной записи с таким телефоном на эту дату не нашлось. Проверьте данные или свяжитесь с нами.',
    UZ: 'Bu telefon va sana bo‘yicha faol yozuv topilmadi. Ma’lumotlarni tekshiring yoki biz bilan bog‘laning.',
    EN: 'No active booking found for that phone and date. Check the details or contact us.',
  },
  failed: {
    RU: 'Не удалось отменить автоматически — позвоните нам или напишите в Telegram.',
    UZ: 'Avtomatik bekor qilib bo‘lmadi — qo‘ng‘iroq qiling yoki Telegramga yozing.',
    EN: 'Could not cancel automatically — please call us or message on Telegram.',
  },
  doneTitle: { RU: 'Запись отменена', UZ: 'Yozuv bekor qilindi', EN: 'Booking cancelled' },
  doneText: {
    RU: 'Время освобождено. Будем рады видеть вас в другой день — записывайтесь онлайн в любое время.',
    UZ: 'Vaqt bo‘shatildi. Boshqa kuni kutamiz — istalgan vaqtda onlayn yozilishingiz mumkin.',
    EN: 'The slot is free again. We would love to see you another day — book online any time.',
  },
  close: { RU: 'Закрыть', UZ: 'Yopish', EN: 'Close' },
  orCall: { RU: 'Или свяжитесь с нами', UZ: 'Yoki biz bilan bog‘laning', EN: 'Or contact us' },
};

/** Self-service cancellation: phone + date, no account needed. */
export default function CancelModal({ language, onClose }: CancelModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);
  const reduced = useReducedMotion();

  const doneHeadingRef = useRef<HTMLHeadingElement>(null);
  // Blocks a second tap from firing a parallel cancel before React re-renders
  // the button as disabled.
  const submitLockRef = useRef(false);
  // The backdrop closes the dialog only when the press *started* on it —
  // otherwise releasing a text selection over the backdrop wipes the form.
  const overlayPressRef = useRef(false);

  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // The form unmounts on success, so the focused control disappears and focus
  // would fall outside the dialog — move it onto the confirmation heading.
  useEffect(() => {
    if (done) doneHeadingRef.current?.focus();
  }, [done]);

  const t = (loc: (typeof TR)[keyof typeof TR]) => getLocalized(loc, language);

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!phone.trim() || !date) {
      setError(t(TR.errFill));
      return;
    }
    setError('');
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const cancelled = await cancelBookingByPhone(phone.trim(), date);
      if (cancelled === null) setError(t(TR.failed));
      else if (cancelled === 0) setError(t(TR.notFound));
      else setDone(true);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const inputCls =
    'field w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-primary';

  return createPortal(
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
        className="max-h-[92vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-canvas p-6 shadow-2xl sm:rounded-2xl sm:p-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display text-2xl text-ink sm:text-3xl">{t(TR.title)}</h2>
          <button
            onClick={onClose}
            aria-label={t(TR.close)}
            className="press-inner -mr-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink"
          >
            <X size={22} />
          </button>
        </div>

        {done ? (
          <div className="text-center">
            {/* Scoped to the confirmation copy — a live region around the whole
                screen would read out the button below it too. */}
            <div role="status">
              <CheckCircle2 size={52} className="mx-auto text-success" />
              <h3 ref={doneHeadingRef} tabIndex={-1} className="display mt-4 text-2xl text-ink outline-none">
                {t(TR.doneTitle)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(TR.doneText)}</p>
            </div>
            <button
              onClick={onClose}
              className="btn-press press-slab mt-6 w-full rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              {t(TR.close)}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted">{t(TR.intro)}</p>
            <div className="mt-5 space-y-2.5">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={`${t(TR.phone)} · +998 __ ___-__-__`}
                aria-label={t(TR.phone)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={32}
                className={inputCls}
              />
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                type="date"
                aria-label={t(TR.date)}
                className={inputCls}
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
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {t(TR.submit)}
            </button>

            <div className="mt-6 border-t border-hairline pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(TR.orCall)}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <a
                  href={`tel:${PHONE.replace(/[^+\d]/g, '')}`}
                  className="btn-press ink-rule rule-slab inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-ink hover:border-ink"
                >
                  <Phone size={15} /> {PHONE}
                </a>
                <a
                  href={`https://t.me/${MANAGER_TELEGRAM}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press ink-rule rule-slab inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-ink hover:border-ink"
                >
                  <Send size={15} /> Telegram
                </a>
              </div>
            </div>
          </>
        )}
      </m.div>
    </div>,
    document.body,
  );
}
