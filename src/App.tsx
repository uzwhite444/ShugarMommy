import { lazy, Suspense, useEffect, useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Advantages from './components/Advantages';
import Ingredients from './components/Ingredients';
import StatsBand from './components/StatsBand';
import Services from './components/Services';
import Process from './components/Process';
import Quiz from './components/Quiz';
import Masters from './components/Masters';
import Promos from './components/Promos';
import Gallery from './components/Gallery';
import Reviews from './components/Reviews';
import Faq from './components/Faq';
import Contacts from './components/Contacts';
import Footer from './components/Footer';
import BookingModal from './components/BookingModal';

// Admin panel is code-split — visitors never download it.
const AdminGate = lazy(() => import('./components/AdminGate'));
import { SERVICE_ZONES } from './data';
import { LanguageCode } from './types';
import { loadFromStorage } from './utils';

const LANG_KEY = 'shugarmommy-lang';

export default function App() {
  const [language, setLanguage] = useState<LanguageCode>(() =>
    loadFromStorage<LanguageCode>(LANG_KEY, 'RU'),
  );
  // "?zones=a,b,c" — shared combo links preselect zones in the calculator.
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(() => {
    const param = new URLSearchParams(window.location.search).get('zones');
    if (!param) return [];
    const validIds = new Set(SERVICE_ZONES.map((z) => z.id));
    return param.split(',').filter((id) => validIds.has(id));
  });
  const [bookingOpen, setBookingOpen] = useState(false);
  const [route, setRoute] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Keep <html lang> in sync so screen readers and search engines see the
  // actual page language (WCAG 3.1.1), not the hardcoded "ru" from index.html.
  useEffect(() => {
    document.documentElement.lang = language.toLowerCase();
  }, [language]);

  const changeLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    try {
      localStorage.setItem(LANG_KEY, JSON.stringify(lang));
    } catch {
      // Storage full/blocked — language just won't persist.
    }
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
    );
  };

  if (route.startsWith('#/admin')) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream" />}>
        <AdminGate />
      </Suspense>
    );
  }

  const selectedZones = SERVICE_ZONES.filter((z) => selectedZoneIds.includes(z.id));

  return (
    <div className="relative min-h-screen bg-canvas font-sans text-ink antialiased">
      <Header language={language} onChangeLanguage={changeLanguage} onBook={() => setBookingOpen(true)} />
      <main>
        <Hero language={language} onBook={() => setBookingOpen(true)} />
        <Advantages language={language} />
        <Ingredients language={language} />
        <StatsBand language={language} />
        <Services
          language={language}
          selectedZoneIds={selectedZoneIds}
          onToggleZone={toggleZone}
          onBook={() => setBookingOpen(true)}
        />
        <Process language={language} />
        <Quiz
          language={language}
          onApplyZones={(zoneIds) => setSelectedZoneIds(zoneIds)}
          onBook={() => setBookingOpen(true)}
        />
        <Masters language={language} />
        <Promos language={language} onBook={() => setBookingOpen(true)} />
        <Gallery language={language} />
        <Reviews language={language} />
        <Faq language={language} />
        <Contacts language={language} />
      </main>
      <Footer language={language} />
      {bookingOpen && (
        <BookingModal
          language={language}
          selectedZones={selectedZones}
          onClose={() => setBookingOpen(false)}
          onRemoveZone={toggleZone}
        />
      )}
    </div>
  );
}
