import { Localized } from '../../types';
import { inputCls } from './bookingDisplay';
import { StepLabel } from './StepLabel';
import { TR } from './tr';

interface StepContactsProps {
  t: (loc: Localized) => string;
  name: string;
  setName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  onFieldKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/** Step 01 — name and phone. */
export function StepContacts({ t, name, setName, phone, setPhone, onFieldKeyDown }: StepContactsProps) {
  return (
    <div>
      <StepLabel number="01">{t(TR.stepContacts)}</StepLabel>
      {/* Enter submits, as it would inside a <form>. A real <form> is
          not usable here: the nine buttons below (masters, dates,
          slots, zone chips) carry no type="button", so wrapping them
          would turn picking a date into a submit. */}
      <div className="mt-3 space-y-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(TR.name)}
          aria-label={t(TR.name)}
          autoComplete="name"
          maxLength={120}
          onKeyDown={onFieldKeyDown}
          className={inputCls}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={`${t(TR.phone)} · +998 __ ___-__-__`}
          aria-label={t(TR.phone)}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={32}
          onKeyDown={onFieldKeyDown}
          className={inputCls}
        />
      </div>
    </div>
  );
}
