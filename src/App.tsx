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
import StickyCta from './components/StickyCta';
import { captureSource } from './lib/attribution';
import { calcTotal } from './utils';

// Admin panel and the legal page are code-split — visitors never download
// them unless they navigate there.
const AdminGate = lazy(() => import('./components/AdminGate'));
const PrivacyPage = lazy(() => import('./components/PrivacyPage'));

// Both modals only mount after a click, so they stay out of the landing
// chunk. The same import is reused to warm the chunk while the browser is
// idle, which keeps the first tap instant.
const importBookingModal = () => import('./components/BookingModal');
const importCancelModal = () => import('./components/CancelModal');
const BookingModal = lazy(importBookingModal);
const CancelModal = lazy(importCancelModal);
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
  const [cancelOpen, setCancelOpen] = useState(false);
  // Booking code the cancellation form should open with — set from the
  // reminder link or from the confirmation screen, empty when the visitor
  // reaches the form from the contacts block and has to type it herself.
  const [cancelCode, setCancelCode] = useState('');
  const [route, setRoute] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // #/cancel?code=… — the link we put in reminder messages: open the form
  // straight away with the code filled in, then clear the hash so refreshing
  // does not reopen it and the code does not sit in the address bar. The code
  // alone cancels nothing — the form still asks for the booking phone.
  useEffect(() => {
    if (!route.startsWith('#/cancel')) return;
    const query = route.indexOf('?');
    const code = query === -1 ? '' : (new URLSearchParams(route.slice(query + 1)).get('code') ?? '');
    // A UUID is 36 characters; anything longer is not a code we sent.
    setCancelCode(code.slice(0, 40));
    setCancelOpen(true);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setRoute('');
  }, [route]);

  // Keep <html lang> in sync so screen readers and search engines see the
  // actual page language (WCAG 3.1.1), not the hardcoded "ru" from index.html.
  useEffect(() => {
    document.documentElement.lang = language.toLowerCase();
  }, [language]);

  // Remember the traffic channel once per session for booking attribution.
  useEffect(() => {
    captureSource();
  }, []);

  // Prefetch the modal chunk after the landing page is interactive, so the
  // code split costs nothing at click time.
  useEffect(() => {
    const warm = () => {
      void importBookingModal();
      void importCancelModal();
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const changeLanguage = (lang: LanguageCode) => {
    const apply = () => {
      setLanguage(lang);
      try {
        localStorage.setItem(LANG_KEY, JSON.stringify(lang));
      } catch {
        // Storage full/blocked — language just won't persist.
      }
    };

    // Cross-fade the copy instead of snapping to the new language.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    type ViewTransitionLike = { ready?: Promise<unknown>; finished?: Promise<unknown> };
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => ViewTransitionLike | void;
    };
    if (!reduced && typeof doc.startViewTransition === 'function') {
      const transition = doc.startViewTransition(apply);
      // A transition is SKIPPED whenever the tab is hidden or another one is
      // still running (tapping RU → UZ → EN quickly). `ready` then rejects, and
      // with nothing awaiting it the rejection lands in the console as an
      // uncaught InvalidStateError. The language switch itself is unaffected.
      transition?.ready?.catch(() => {});
      transition?.finished?.catch(() => {});
    } else {
      apply();
    }
  };

  const openCancel = (code = '') => {
    setCancelCode(code);
    setCancelOpen(true);
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
    );
  };

  if (route.startsWith('#/admin')) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-canvas" />}>
        <AdminGate />
      </Suspense>
    );
  }

  if (route.startsWith('#/privacy')) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-canvas" />}>
        <PrivacyPage language={language} />
      </Suspense>
    );
  }

  const selectedZones = SERVICE_ZONES.filter((z) => selectedZoneIds.includes(z.id));
  // Shared price list — no master is chosen at this level.
  const selectionCalc = calcTotal(selectedZones);

  return (
    <div className="relative min-h-screen bg-canvas font-sans text-ink antialiased">
      <Header language={language} onChangeLanguage={changeLanguage} onBook={() => setBookingOpen(true)} />
      <main>
        <Hero language={language} onBook={() => setBookingOpen(true)} />
        <Advantages language={language} />
        <Ingredients language={language} />
        {/* The owner was asked about these four figures and chose to keep them
            as they are. The 7-year one does have a real basis — it is Рената's
            record — even though she is hidden from the roster for now. */}
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
        <Contacts language={language} onCancelBooking={() => openCancel()} />
      </main>
      <Footer language={language} />
      <StickyCta
        language={language}
        total={selectionCalc.total}
        hasPricedZones={selectionCalc.pricedZones.length > 0}
        zoneCount={selectedZones.length}
        onBook={() => setBookingOpen(true)}
        hidden={bookingOpen}
      />
      {/* No fallback: the chunk is already warm and the modal animates itself in. */}
      <Suspense fallback={null}>
        {bookingOpen && (
          <BookingModal
            language={language}
            selectedZones={selectedZones}
            onClose={() => setBookingOpen(false)}
            onRemoveZone={toggleZone}
            onCancelBooking={(code) => {
              setBookingOpen(false);
              openCancel(code);
            }}
          />
        )}
        {cancelOpen && (
          <CancelModal
            language={language}
            initialCode={cancelCode}
            onClose={() => {
              setCancelOpen(false);
              // Otherwise the next visitor to open the form from the contacts
              // block would find someone else's code sitting in the field.
              setCancelCode('');
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
