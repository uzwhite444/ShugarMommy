import { LanguageCode } from '../types';
import { getLocalized } from '../utils';

interface FooterProps {
  language: LanguageCode;
}

const TR = {
  tagline: {
    RU: 'Студия шугаринга — гладкая кожа и уверенность каждый день.',
    UZ: 'Shugaring studiyasi — har kuni silliq teri va ishonch.',
    EN: 'Sugaring studio — smooth skin and confidence every day.',
  },
  rights: { RU: 'Все права защищены', UZ: 'Barcha huquqlar himoyalangan', EN: 'All rights reserved' },
  privacy: { RU: 'Политика конфиденциальности', UZ: 'Maxfiylik siyosati', EN: 'Privacy policy' },
};

export default function Footer({ language }: FooterProps) {
  return (
    <footer className="bg-dark px-4 py-12 text-ondark sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-serif text-xl font-semibold">
            Shugar Mommy<span className="text-primary">.</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-ondark-soft">{getLocalized(TR.tagline, language)}</p>
        </div>
        <div className="text-xs text-ondark-soft sm:text-right">
          <a href="#/privacy" className="btn-press ink-rule rule-tight rule-on-dark rule-short inline-flex min-h-11 items-center font-semibold hover:text-ondark">
            {getLocalized(TR.privacy, language)}
          </a>
          <p className="mt-2">
            © {new Date().getFullYear()} Shugar Mommy · {getLocalized(TR.rights, language)}
          </p>
        </div>
      </div>
    </footer>
  );
}
