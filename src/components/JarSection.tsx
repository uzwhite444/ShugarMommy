import Reveal from './ui/Reveal';
import LiquidVideo from './ui/LiquidVideo';
import { LanguageCode } from '../types';
import { getLocalized } from '../utils';
import jarFull from '../assets/jar-full.webp';

interface JarSectionProps {
  language: LanguageCode;
}

const TR = {
  eyebrow: { RU: 'Собственная варка', UZ: "O'z tayyorlovimiz", EN: 'Made in-house' },
  title: {
    RU: 'Каждая капля — в дело',
    UZ: 'Har bir tomchi — ishga',
    EN: 'Every drop put to work',
  },
  text: {
    RU: 'Варим пасту небольшими партиями и храним в стекле — на вашу процедуру всегда идёт свежая.',
    UZ: "Pastani kichik partiyalarda tayyorlaymiz va shishada saqlaymiz — muolajangizga doim yangi pasta ishlatiladi.",
    EN: 'We cook the paste in small batches and store it in glass — your procedure always gets a fresh one.',
  },
  alt: { RU: 'Банка сахарной пасты', UZ: 'Shakar pastasi bankasi', EN: 'A jar of sugaring paste' },
};

/**
 * The end of the liquid story: a Higgsfield film of amber paste pouring
 * into the storage jar, playing once each time it scrolls into view.
 */
export default function JarSection({ language }: JarSectionProps) {
  return (
    <section className="px-4 pb-4 pt-8 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto]">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-3 text-3xl text-ink sm:text-4xl">{getLocalized(TR.title, language)}</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{getLocalized(TR.text, language)}</p>
        </Reveal>

        <div id="jar-anchor" className="justify-self-center lg:justify-self-end">
          <LiquidVideo
            src="/videos/jar-fill.mp4"
            label={getLocalized(TR.alt, language)}
            className="h-52 w-52 select-none object-cover sm:h-64 sm:w-64"
            fallback={
              <img
                src={jarFull}
                alt={getLocalized(TR.alt, language)}
                width={480}
                height={480}
                loading="lazy"
                draggable={false}
                className="h-44 w-44 select-none sm:h-52 sm:w-52"
              />
            }
          />
        </div>
      </div>
    </section>
  );
}
