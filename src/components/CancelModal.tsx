import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion } from 'motion/react';
import { CheckCircle2, KeyRound, Loader2, Phone, Send, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalized, MANAGER_TELEGRAM, PHONE, telHref } from '../utils';
import { cancelBookingByCode, formatBookingCode, normalizeBookingCode } from '../lib/bookings';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface CancelModalProps {
  language: LanguageCode;
  /** Code carried in from the reminder link or the confirmation screen. */
  initialCode?: string;
  onClose: () => void;
}

const TR = {
  title: { RU: 'Отменить запись', UZ: 'Yozuvni bekor qilish', EN: 'Cancel a booking' },
  intro: {
    RU: 'Нужны код записи и телефон, с которого вы записывались. Код мы показали сразу после записи и присылаем в напоминании за час до визита.',
    UZ: 'Yozuv kodi va yozilishda ishlatgan telefoningiz kerak. Kodni yozuvdan keyin darhol ko‘rsatamiz va tashrifdan bir soat oldingi eslatmada yuboramiz.',
    EN: 'We need the booking code and the phone you booked with. The code is shown right after booking and comes in the reminder an hour before the visit.',
  },
  code: { RU: 'Код записи', UZ: 'Yozuv kodi', EN: 'Booking code' },
  codeHint: {
    RU: '8 символов — цифры и буквы A–F. Ищите его в переписке с администратором или в напоминании от бота.',
    UZ: '8 ta belgi — raqamlar va A–F harflari. Uni administrator bilan yozishmangizda yoki botning eslatmasida qidiring.',
    EN: '8 characters — digits and letters A–F. Look for it in your chat with the administrator or in the bot reminder.',
  },
  phone: { RU: 'Телефон', UZ: 'Telefon', EN: 'Phone' },
  submit: { RU: 'Отменить запись', UZ: 'Bekor qilish', EN: 'Cancel booking' },
  errFill: {
    RU: 'Укажите код записи и телефон.',
    UZ: 'Yozuv kodi va telefonni kiriting.',
    EN: 'Please enter the booking code and the phone.',
  },
  errCodeShape: {
    RU: 'Код состоит из 8 символов: цифры и буквы A–F. Например 3F7A-9C21.',
    UZ: 'Kod 8 ta belgidan iborat: raqamlar va A–F harflari. Masalan 3F7A-9C21.',
    EN: 'The code is 8 characters: digits and letters A–F. For example 3F7A-9C21.',
  },
  // One message for every mismatch — wrong code, wrong phone, already
  // cancelled. Naming which one failed would turn this form into a way of
  // checking whether a phone number has a booking at all.
  notMatched: {
    RU: 'Отменить не получилось. Проверьте код и телефон — они должны быть теми же, что при записи. Если запись уже отменена или визит прошёл, отменять нечего.',
    UZ: 'Bekor qilib bo‘lmadi. Kod va telefonni tekshiring — ular yozilishdagidek bo‘lishi kerak. Agar yozuv allaqachon bekor qilingan yoki tashrif o‘tgan bo‘lsa, bekor qiladigan narsa yo‘q.',
    EN: 'That did not work. Check the code and the phone — both must match the booking. If it is already cancelled or the visit has passed, there is nothing to cancel.',
  },
  throttled: {
    RU: 'Слишком много попыток подряд. Подождите 15 минут или позвоните нам — отменим сразу.',
    UZ: 'Ketma-ket urinishlar juda ko‘p. 15 daqiqa kuting yoki qo‘ng‘iroq qiling — darhol bekor qilamiz.',
    EN: 'Too many attempts in a row. Wait 15 minutes or call us — we will cancel it right away.',
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
  lostCode: {
    RU: 'Не нашли код? Позвоните или напишите — отменим запись за вас.',
    UZ: 'Kod topilmadimi? Qo‘ng‘iroq qiling yoki yozing — yozuvni o‘zimiz bekor qilamiz.',
    EN: 'Lost the code? Call or message us — we will cancel it for you.',
  },
};

/** Self-service cancellation: booking code + the phone it was made with. */
export default function CancelModal({ language, initialCode, onClose }: CancelModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);
  const reduced = useReducedMotion();

  const doneHeadingRef = useRef<HTMLHeadingElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  // Blocks a second tap from firing a parallel cancel before React re-renders
  // the button as disabled.
  const submitLockRef = useRef(false);
  // The backdrop closes the dialog only when the press *started* on it —
  // otherwise releasing a text selection over the backdrop wipes the form.
  const overlayPressRef = useRef(false);

  // A code arriving from a link is shown in the readable form, so she can see
  // it is the same code she was given rather than a string of noise.
  const [code, setCode] = useState(() => formatBookingCode(initialCode ?? '') ?? '');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Whether the code arrived ready-made. Read once at mount: recomputing it
  // from `code` would flip while she types and pull focus out of the field.
  const prefilledRef = useRef(code !== '');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Arriving from the reminder link there is exactly one thing left to type.
  // This runs after the focus trap's own effect, so it wins.
  useEffect(() => {
    if (prefilledRef.current) phoneRef.current?.focus();
  }, []);

  // The form unmounts on success, so the focused control disappears and focus
  // would fall outside the dialog — move it onto the confirmation heading.
  useEffect(() => {
    if (done) doneHeadingRef.current?.focus();
  }, [done]);

  const t = (loc: (typeof TR)[keyof typeof TR]) => getLocalized(loc, language);

  /** Enter in a field submits — the behaviour a <form> would give. */
  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    void handleSubmit();
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!code.trim() || !phone.trim()) {
      setError(t(TR.errFill));
      return;
    }
    // Caught here rather than sent to the server: a code this shape can never
    // match anything, and a wasted attempt counts against the throttle that
    // protects her from someone else guessing.
    const normalized = normalizeBookingCode(code);
    if (!normalized) {
      setError(t(TR.errCodeShape));
      return;
    }
    setError('');
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await cancelBookingByCode(normalized, phone.trim());
      if (result === 'ok') setDone(true);
      else if (result === 'throttled') setError(t(TR.throttled));
      else if (result === 'mismatch') setError(t(TR.notMatched));
      else setError(t(TR.failed));
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const inputCls =
    'field w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-primary';

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
              <div>
                <div className="relative">
                  <KeyRound
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="3F7A-9C21"
                    aria-label={t(TR.code)}
                    aria-describedby="cancel-code-hint"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    onKeyDown={onFieldKeyDown}
                    maxLength={40}
                    className={`${inputCls} pl-11 font-mono uppercase tracking-[0.12em]`}
                  />
                </div>
                <p id="cancel-code-hint" className="mt-1.5 text-xs leading-relaxed text-faint">
                  {t(TR.codeHint)}
                </p>
              </div>
              {/* The phone stays a second factor and is never pre-filled: a
                  forwarded reminder link carries the code alone, so it cannot
                  cancel anybody else's visit. */}
              <input
                ref={phoneRef}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={`${t(TR.phone)} · +998 __ ___-__-__`}
                aria-label={t(TR.phone)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                onKeyDown={onFieldKeyDown}
                maxLength={32}
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
              <p className="text-xs leading-relaxed text-muted">{t(TR.lostCode)}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <a
                  href={telHref(PHONE)}
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
