import Reveal from './ui/Reveal';
import { LanguageCode } from '../types';
import { getLocalized } from '../utils';

interface GalleryProps {
  language: LanguageCode;
}

/**
 * Auto-imports every image dropped into src/assets/gallery/.
 * While the folder is empty the section shows quiet placeholder tiles,
 * so the site looks finished before real photos arrive.
 */
const galleryImages = Object.entries(
  import.meta.glob('../assets/gallery/*.{jpg,jpeg,png,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
).map(([path, url]) => ({ path, url: url as string }));

const TR = {
  eyebrow: { RU: 'Пространство', UZ: 'Makon', EN: 'The space' },
  title: { RU: 'Наша студия', UZ: 'Bizning studiya', EN: 'Our studio' },
  subtitle: {
    RU: 'Уютное пространство, где заботятся о вашем комфорте и приватности.',
    UZ: 'Qulaylik va shaxsiy makon haqida g‘amxo‘rlik qilinadigan shinam joy.',
    EN: 'A cosy space built around your comfort and privacy.',
  },
  placeholders: [
    { RU: 'Зона ресепшн', UZ: 'Qabul zonasi', EN: 'Reception' },
    { RU: 'Кабинет №1', UZ: '1-xona', EN: 'Room 1' },
    { RU: 'Кабинет №2', UZ: '2-xona', EN: 'Room 2' },
    { RU: 'Зона отдыха', UZ: 'Dam olish zonasi', EN: 'Lounge' },
    { RU: 'Материалы', UZ: 'Materiallar', EN: 'Materials' },
    { RU: 'Стерилизация', UZ: 'Sterilizatsiya', EN: 'Sterilisation' },
  ],
  soon: { RU: 'Фото скоро', UZ: 'Tez orada', EN: 'Photo soon' },
};

export default function Gallery({ language }: GalleryProps) {
  return (
    <section id="gallery" className="bg-soft px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {getLocalized(TR.subtitle, language)}
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {galleryImages.length > 0
            ? galleryImages.map(({ path, url }, i) => (
                <Reveal key={path} delay={(i % 3) * 0.06}>
                  <div className="group overflow-hidden rounded-xl">
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      width={600}
                      height={450}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                </Reveal>
              ))
            : TR.placeholders.map((label, i) => (
                <Reveal key={label.EN} delay={(i % 3) * 0.06}>
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-hairline bg-canvas">
                    <p className="font-serif text-lg font-medium text-body">{getLocalized(label, language)}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-faint">{getLocalized(TR.soon, language)}</p>
                  </div>
                </Reveal>
              ))}
        </div>
      </div>
    </section>
  );
}
