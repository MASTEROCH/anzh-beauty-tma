import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { AiChatBubble } from './components/AiChatBubble';
import { SheetHost, ToastHost } from './components/UIHost';
import { ProfileScreen } from './screens/ProfileScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { ServiceScreen } from './screens/ServiceScreen';
import { BookingScreen } from './screens/BookingScreen';
import { AccountScreen } from './screens/AccountScreen';
import { AnzhScreen } from './screens/AnzhScreen';
import { ConfirmScreen } from './screens/ConfirmScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { toast } from './lib/ui';

const ONB_KEY = 'anzh_onboarded';

export type Screen = 'profile' | 'catalog' | 'service' | 'booking' | 'account' | 'anzh' | 'confirm';
export type Lang = 'ru' | 'en';
export type Currency = 'usd' | 'gel';

function initialScreen(): Screen {
  if (typeof window === 'undefined') return 'profile';
  const h = window.location.hash.replace('#', '') as Screen;
  const valid: Screen[] = ['profile', 'catalog', 'service', 'booking', 'account', 'anzh', 'confirm'];
  return valid.includes(h) ? h : 'profile';
}

function navigate(setter: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof d.startViewTransition === 'function') {
    d.startViewTransition(setter);
  } else {
    setter();
  }
}

export function App() {
  const [screen, setScreenRaw] = useState<Screen>(initialScreen);
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [lang, setLang] = useState<Lang>('ru');
  const [currency, setCurrency] = useState<Currency>('usd');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loyaltyPoints, setLoyaltyPoints] = useState(380);
  const [userName, setUserName] = useState<string>('Маша');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.hash === '#onboarding') return true;
    // Query param ?seed=1 bypasses onboarding (used for screenshot tests)
    if (window.location.search.includes('seed=1')) return false;
    return !localStorage.getItem(ONB_KEY);
  });

  function finishOnboarding(data: { name: string; phone: string }) {
    localStorage.setItem(ONB_KEY, '1');
    setUserName(data.name || 'красавица');
    setLoyaltyPoints((p) => p + 50);
    setShowOnboarding(false);
    setScreenRaw('profile');
    setTimeout(() => toast(`Добро пожаловать, ${data.name || 'красавица'}! +50 баллов на старт`, 'success'), 250);
  }

  function skipOnboarding() {
    localStorage.setItem(ONB_KEY, '1');
    setShowOnboarding(false);
    setScreenRaw('profile');
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.location.hash = screen;
  }, [screen]);

  // Auto-hide the mascot when the active .screen is scrolled near its bottom,
  // so it doesn't overlap content (e.g. the booking summary). Comes back on scroll up.
  useEffect(() => {
    function onScroll(e: Event) {
      const target = e.target as HTMLElement | null;
      if (!target || !target.classList?.contains('screen')) return;
      const dist = target.scrollHeight - target.scrollTop - target.clientHeight;
      const near = dist < 180;
      const root = document.body;
      if (near && !root.hasAttribute('data-near-bottom')) {
        root.setAttribute('data-near-bottom', '');
      } else if (!near && root.hasAttribute('data-near-bottom')) {
        root.removeAttribute('data-near-bottom');
      }
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  // Clear the near-bottom flag on every screen change so the mascot reappears.
  useEffect(() => {
    document.body.removeAttribute('data-near-bottom');
  }, [screen]);

  const setScreen = (next: Screen) => navigate(() => setScreenRaw(next));

  const openService = (id: string) => {
    setServiceId(id);
    setScreen('service');
  };
  const openBooking = (id?: string) => {
    if (id) setServiceId(id);
    setScreen('booking');
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLang = (l: Lang) => {
    setLang(l);
    toast(l === 'ru' ? 'Язык: русский' : 'Language: English', 'success');
  };

  if (showOnboarding) {
    return (
      <div className="app">
        <OnboardingScreen onComplete={finishOnboarding} onSkip={skipOnboarding} />
        <ToastHost />
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'profile' && (
        <ProfileScreen
          onBook={() => openBooking()}
          onCatalog={() => setScreen('catalog')}
          lang={lang}
          onLang={handleLang}
          onAwardPoints={(p) => setLoyaltyPoints((x) => x + p)}
        />
      )}
      {screen === 'catalog' && (
        <CatalogScreen
          onOpen={openService}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          currency={currency}
          onCurrency={setCurrency}
        />
      )}
      {screen === 'service' && (
        <ServiceScreen
          serviceId={serviceId ?? 'lip-filler'}
          onBack={() => setScreen('catalog')}
          onBook={(id) => openBooking(id)}
          currency={currency}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}
      {screen === 'booking' && (
        <BookingScreen
          initialServiceId={serviceId}
          onConfirm={() => setScreen('confirm')}
          onChooseService={() => setScreen('catalog')}
          currency={currency}
        />
      )}
      {screen === 'confirm' && (
        <ConfirmScreen onDone={() => setScreen('profile')} onAccount={() => setScreen('account')} />
      )}
      {screen === 'account' && (
        <AccountScreen
          onBook={() => openBooking()}
          onReschedule={() => openBooking(serviceId ?? 'lip-filler')}
          lang={lang}
          onLang={handleLang}
          currency={currency}
          onCurrency={setCurrency}
          points={loyaltyPoints}
          onAwardPoints={(p) => setLoyaltyPoints((x) => x + p)}
          userName={userName}
        />
      )}
      {screen === 'anzh' && <AnzhScreen />}

      <BottomNav
        current={screen === 'service' || screen === 'confirm' ? 'catalog' : screen}
        onChange={(s) => {
          if (s === 'booking') openBooking();
          else setScreen(s);
        }}
      />

      <AiChatBubble screen={screen} onBookingNav={() => openBooking()} />

      <SheetHost />
      <ToastHost />
    </div>
  );
}
