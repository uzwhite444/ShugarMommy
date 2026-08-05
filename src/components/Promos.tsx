import { Gift } from 'lucide-react';
import Reveal from './ui/Reveal';
import { LanguageCode } from '../types';
import { DISCOUNT_TIERS, getLocalized, MANAGER_TELEGRAM } from '../utils';

interface PromosProps {
  language: LanguageCode;
  onBook: () => void;
}

const TR = {
  eyebrow: { RU: 'Акции', UZ: 'Aksiyalar', EN: 'Offers' },
  title: { RU: 'Сейчас выгодно', UZ: 'Ayni damda foydali', EN: 'Good time to book' },
  first: {
    badge: { RU: 'Новым клиенткам', UZ: 'Yangi mijozlarga', EN: 'For new clients' },
    value: '−20%',
    title: { RU: 'Первый визит', UZ: 'Birinchi tashrif', EN: 'First visit' },
    text: {
      RU: 'Скидка 20% на первую процедуру — познакомьтесь со студией без лишних трат.',
      UZ: 'Birinchi muolajaga 20% chegirma — studiya bilan ortiqcha xarajatsiz tanishing.',
      EN: 'A 20% discount on your first procedure — meet the studio without overspending.',
    },
    cta: { RU: 'Записаться', UZ: 'Yozilish', EN: 'Book now' },
  },
  combo: {
    // Wording is derived from DISCOUNT_TIERS so the promo can never promise a
    // discount the calculator does not apply.
    value: {
      RU: `до −${DISCOUNT_TIERS[0].pct}%`,
      UZ: `−${DISCOUNT_TIERS[0].pct}% gacha`,
      EN: `up to −${DISCOUNT_TIERS[0].pct}%`,
    },
    title: { RU: 'Комплекс зон', UZ: 'Zonalar kompleksi', EN: 'Zone combo' },
    text: {
      RU: `Выберите ${DISCOUNT_TIERS[1].minZones}+ зоны в калькуляторе — скидка ${DISCOUNT_TIERS[1].pct}%, от ${DISCOUNT_TIERS[0].minZones} зон — ${DISCOUNT_TIERS[0].pct}%. Применяется автоматически.`,
      UZ: `Kalkulyatorda ${DISCOUNT_TIERS[1].minZones}+ zonani tanlang — ${DISCOUNT_TIERS[1].pct}% chegirma, ${DISCOUNT_TIERS[0].minZones} zonadan — ${DISCOUNT_TIERS[0].pct}%. Avtomatik qo‘llanadi.`,
      EN: `Pick ${DISCOUNT_TIERS[1].minZones}+ zones in the calculator for ${DISCOUNT_TIERS[1].pct}% off, ${DISCOUNT_TIERS[0].minZones}+ zones for ${DISCOUNT_TIERS[0].pct}% — applied automatically.`,
    },
    cta: { RU: 'Собрать комплекс', UZ: "Kompleks yig'ish", EN: 'Build a combo' },
  },
  gift: {
    title: { RU: 'Подарочный сертификат', UZ: 'Sovg‘a sertifikati', EN: 'Gift certificate' },
    text: {
      RU: 'Любой номинал, красивое оформление — подарите гладкость близкому человеку.',
      UZ: 'Istalgan qiymat, chiroyli bezatish — yaqiningizga silliqlik sovg‘a qiling.',
      EN: 'Any amount, beautifully presented — give smoothness to someone you love.',
    },
    cta: { RU: 'Оформить в Telegram', UZ: 'Telegramda rasmiylashtirish', EN: 'Arrange on Telegram' },
  },
  note: {
    RU: 'Скидки не суммируются с другими акциями.',
    UZ: 'Chegirmalar boshqa aksiyalar bilan qo‘shilmaydi.',
    EN: 'Discounts do not stack with other offers.',
  },
};

export default function Promos({ language, onBook }: PromosProps) {
  return (
    <section id="promos" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Terracotta callout — the one loud card on the page */}
          <Reveal>
            <div className="flex h-full flex-col rounded-xl bg-primary p-8 text-white transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <span className="self-start rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
                {getLocalized(TR.first.badge, language)}
              </span>
              <p className="display mt-6 text-6xl">{TR.first.value}</p>
              <h3 className="mt-3 text-lg font-semibold">{getLocalized(TR.first.title, language)}</h3>
              {/* No colour utility here on purpose: the paragraph inherits the
                  card's ink, which night mode corrects to dark. An explicit
                  text-white/85 bypasses that correction and drops to 2.2:1. */}
              <p className="mt-2 flex-1 text-sm leading-relaxed">{getLocalized(TR.first.text, language)}</p>
              {/* The card stays light-on-terracotta in both themes, so this
                  always-white button needs tones pinned outside the theme swap. */}
              <button
                onClick={onBook}
                className="mt-6 flex min-h-11 items-center self-start rounded-lg bg-white px-5 text-sm font-semibold text-onwhite transition-colors hover:bg-white-soft"
              >
                {getLocalized(TR.first.cta, language)}
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="flex h-full flex-col rounded-xl bg-surface p-8 transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              {/* One step down on the narrowest phones: "up to −15%" is far
                  wider than the bare number it replaced. */}
              <p className="display text-5xl text-ink sm:text-6xl">{getLocalized(TR.combo.value, language)}</p>
              <h3 className="mt-3 text-lg font-semibold text-ink">{getLocalized(TR.combo.title, language)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {getLocalized(TR.combo.text, language)}
              </p>
              <a
                href="#services"
                className="mt-6 flex min-h-11 items-center self-start rounded-lg border border-ink/20 px-5 text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                {getLocalized(TR.combo.cta, language)}
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="flex h-full flex-col rounded-xl bg-surface p-8 transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <Gift size={36} className="text-primary" strokeWidth={1.5} />
              <h3 className="mt-6 text-lg font-semibold text-ink">{getLocalized(TR.gift.title, language)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {getLocalized(TR.gift.text, language)}
              </p>
              <a
                href={`https://t.me/${MANAGER_TELEGRAM}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex min-h-11 items-center self-start rounded-lg border border-ink/20 px-5 text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                {getLocalized(TR.gift.cta, language)}
              </a>
            </div>
          </Reveal>
        </div>

        <p className="mt-6 text-xs text-faint">{getLocalized(TR.note, language)}</p>
      </div>
    </section>
  );
}
