import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
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
    { RU: 'Зона ожидания', UZ: 'Kutish zonasi', EN: 'Waiting area' },
    { RU: 'Детская зона', UZ: 'Bolalar zonasi', EN: 'Kids area' },
    { RU: 'Кабинет 1', UZ: '1-xona', EN: 'Room 1' },
    { RU: 'Кабинет 2', UZ: '2-xona', EN: 'Room 2' },
    { RU: 'Кабинет 3', UZ: '3-xona', EN: 'Room 3' },
    { RU: 'Материалы', UZ: 'Materiallar', EN: 'Materials' },
    { RU: 'Стерилизация', UZ: 'Sterilizatsiya', EN: 'Sterilisation' },
  ],
  soon: { RU: 'Фото скоро', UZ: 'Tez orada', EN: 'Photo soon' },
};

export default function Gallery({ language }: GalleryProps) {
  return (
    <section id="gallery" className="bg-soft px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow={getLocalized(TR.eyebrow, language)}
          title={getLocalized(TR.title, language)}
          subtitle={getLocalized(TR.subtitle, language)}
        />

        {/* Imagery is the one thing on the page that may scale: `frame` settles
            each photo out of a 4% overscale, which is an editorial idiom and
            costs nothing in text re-rasterisation because there is no text.
            The delays used to be `(i % 3) * 0.06` against a grid that is
            2-across until `lg`, so two thirds of the page saw a random pattern. */}
        <Stagger className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-3" delay={0.12}>
          {galleryImages.length > 0
            ? galleryImages.map(({ path, url }) => (
                <StaggerItem key={path} variant="frame" className="group overflow-hidden rounded-xl">
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    width={600}
                    height={450}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </StaggerItem>
              ))
            : TR.placeholders.map((label) => (
                <StaggerItem key={label.EN} variant="frame">
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-hairline bg-canvas">
                    <p className="font-serif text-lg font-medium text-body">{getLocalized(label, language)}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-faint">{getLocalized(TR.soon, language)}</p>
                  </div>
                </StaggerItem>
              ))}
        </Stagger>
      </div>
    </section>
  );
}
