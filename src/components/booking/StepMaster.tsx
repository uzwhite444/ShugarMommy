import { LanguageCode, Localized, Master, ServiceZone } from '../../types';
import { getLocalized, masterInitial } from '../../utils';
import { MASTERS } from '../../data';
import { StepLabel } from './StepLabel';
import { TR } from './tr';

interface StepMasterProps {
  t: (loc: Localized) => string;
  language: LanguageCode;
  activeMasterId: string;
  soleMaster: Master | null;
  eligibleMasters: readonly Master[];
  restrictedZones: ServiceZone[];
  setMasterId: (id: string) => void;
}

/** Step 02 — master picker. */
export function StepMaster({
  t,
  language,
  activeMasterId,
  soleMaster,
  eligibleMasters,
  restrictedZones,
  setMasterId,
}: StepMasterProps) {
  return (
    <div>
      <StepLabel number="02">{t(TR.stepMaster)}</StepLabel>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t(TR.stepMaster)}>
        {/* "Любой мастер" is off the table when only one master can do
            the selection: there is nothing left to choose between. */}
        <button
          onClick={() => !soleMaster && setMasterId('')}
          disabled={Boolean(soleMaster)}
          aria-pressed={activeMasterId === ''}
          className={`btn-press ink-rule rule-chip flex items-center gap-2.5 rounded-lg border p-2.5 text-left ${
            soleMaster
              ? 'cursor-not-allowed border-hairline/60 bg-surface/50 text-faint'
              : activeMasterId === ''
                ? 'border-ink bg-ink text-canvas'
                : 'border-hairline bg-canvas hover:border-muted'
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              activeMasterId === '' ? 'bg-canvas/15 text-canvas' : 'bg-surface text-muted'
            }`}
          >
            ✦
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{t(TR.anyMaster)}</span>
            <span
              className={`block truncate text-xs ${
                activeMasterId === '' ? 'text-canvas/60' : 'text-faint'
              }`}
            >
              {soleMaster ? t(TR.anyMasterOff) : t(TR.anyMasterHint)}
            </span>
          </span>
        </button>
        {MASTERS.map((master) => {
          // A master who does not perform every selected zone cannot
          // be booked for this visit — she would have to refuse it.
          const canDo = eligibleMasters.includes(master);
          const selected = activeMasterId === master.id;
          return (
            <button
              key={master.id}
              onClick={() => canDo && setMasterId(master.id)}
              disabled={!canDo}
              aria-pressed={selected}
              className={`btn-press ink-rule rule-chip flex items-center gap-2.5 rounded-lg border p-2.5 text-left ${
                !canDo
                  ? 'cursor-not-allowed border-hairline/60 bg-surface/50 text-faint'
                  : selected
                    ? 'border-ink bg-ink text-canvas'
                    : 'border-hairline bg-canvas hover:border-muted'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold ${
                  !canDo
                    ? 'bg-surface text-faint'
                    : selected
                      ? 'bg-canvas/15 text-canvas'
                      : 'bg-primary-soft text-primary-dark'
                }`}
              >
                {masterInitial(master, language)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {getLocalized(master.name, language)}
                </span>
                <span className={`block truncate text-xs ${selected ? 'text-canvas/60' : 'text-faint'}`}>
                  {canDo ? getLocalized(master.title, language) : t(TR.masterCantDo)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {/* Why the greyed-out cards are greyed out — a disabled control
          with no reason reads as a bug. */}
      {restrictedZones.length > 0 && eligibleMasters.length > 0 && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          {t(TR.onlyMasterNote)
            .replace(
              '{masters}',
              eligibleMasters.map((m) => getLocalized(m.name, language)).join(', '),
            )
            .replace(
              '{zones}',
              restrictedZones.map((z) => getLocalized(z.name, language)).join(', '),
            )}
        </p>
      )}
      {eligibleMasters.length === 0 && (
        <p className="mt-2.5 text-xs font-semibold leading-relaxed text-danger">
          {t(TR.errNoMaster)}
        </p>
      )}
    </div>
  );
}
