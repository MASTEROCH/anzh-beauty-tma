import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { AiChatBubble } from './components/AiChatBubble';
import { SheetHost, ToastHost, LightboxHost } from './components/UIHost';
import { ProfileScreen } from './screens/ProfileScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { ServiceScreen } from './screens/ServiceScreen';
import { BookingScreen } from './screens/BookingScreen';
import { AccountScreen } from './screens/AccountScreen';
import { AnzhScreen } from './screens/AnzhScreen';
import { ConfirmScreen } from './screens/ConfirmScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { closeSheet, toast, useSheet } from './lib/ui';
import { getLang, setLang as setI18nLang } from './lib/i18n';
import {
  awardPoints,
  setCurrency as setStoreCurrency,
  setUserName as setStoreUserName,
  toggleFavorite as toggleStoreFavorite,
  useStore,
  type Currency,
} from './lib/store';
import { haptic, initTelegram, installGlobalHaptics, setBackButton, tgLang, tgUserName } from './lib/telegram';

const ONB_KEY = 'anzh_onboarded';

export type Screen = 'profile' | 'catalog' | 'service' | 'booking' | 'account' | 'anzh' | 'confirm';
export type Lang = 'ru' | 'en';
export type { Currency };

/* Screens the native BackButton can pop, and where it goes back to. */
const BACK_TO: Partial<Record<Screen, Screen>> = {
  service: 'catalog',
  booking: 'catalog',
  confirm: 'profile',
};

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
  const [rescheduleId, setRescheduleId] = useState<string | undefined>();
  const [lang, setLang] = useState<Lang>(getLang);
  const store = useStore();
  const sheet = useSheet();
  const favorites = useMemo(() => new Set(store.favorites), [store.favorites]);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.hash === '#onboarding') return true;
    // Query param ?seed=1 bypasses onboarding (used for screenshot tests)
    if (window.location.search.includes('seed=1')) return false;
    return !localStorage.getItem(ONB_KEY);
  });

  function finishOnboarding(data: { name: string; phone: string }) {
    localStorage.setItem(ONB_KEY, '1');
    const name = data.name || tgUserName() || 'красавица';
    setStoreUserName(name);
    awardPoints(50);
    setShowOnboarding(false);
    setScreenRaw('profile');
    haptic.notify('success');
    setTimeout(
      () =>
        toast(
          lang === 'ru' ? `Добро пожаловать, ${name}! +50 баллов на старт` : `Welcome, ${name}! +50 points to start`,
          'success',
        ),
      250,
    );
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

  // Deep links and the browser's back button both arrive as a hash change.
  useEffect(() => {
    const onHash = () => setScreenRaw(initialScreen());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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

  // Telegram bootstrap — no-op in a plain browser.
  useEffect(() => {
    initTelegram();
    const off = installGlobalHaptics();
    const tgName = tgUserName();
    if (tgName && store.userName === 'Маша') setStoreUserName(tgName);
    // Respect the Telegram client language on a first run only.
    if (!localStorage.getItem('anzh_lang')) {
      const l = tgLang();
      if (l && l !== lang) { setLang(l); setI18nLang(l); }
    }
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The native BackButton pops an open sheet first, then the screen stack.
  useEffect(() => {
    if (sheet) {
      setBackButton(() => closeSheet());
      return;
    }
    const to = BACK_TO[screen];
    setBackButton(to ? () => setScreen(to) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, sheet]);

  const setScreen = (next: Screen) => navigate(() => setScreenRaw(next));

  const openService = (id: string) => {
    setServiceId(id);
    setScreen('service');
  };
  const openBooking = (id?: string, rescheduleOf?: string) => {
    if (id) setServiceId(id);
    setRescheduleId(rescheduleOf);
    setScreen('booking');
  };

  const handleLang = (l: Lang) => {
    setLang(l);
    setI18nLang(l);
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
          onAwardPoints={awardPoints}
        />
      )}
      {screen === 'catalog' && (
        <CatalogScreen
          onOpen={openService}
          favorites={favorites}
          onToggleFavorite={toggleStoreFavorite}
          currency={store.currency}
          onCurrency={setStoreCurrency}
        />
      )}
      {screen === 'service' && (
        <ServiceScreen
          serviceId={serviceId ?? 'lip-filler'}
          onBack={() => setScreen('catalog')}
          onBook={(id) => openBooking(id)}
          currency={store.currency}
          favorites={favorites}
          onToggleFavorite={toggleStoreFavorite}
        />
      )}
      {screen === 'booking' && (
        <BookingScreen
          initialServiceId={serviceId}
          rescheduleId={rescheduleId}
          onConfirm={() => { setRescheduleId(undefined); setScreen('confirm'); }}
          onChooseService={() => setScreen('catalog')}
          currency={store.currency}
        />
      )}
      {screen === 'confirm' && (
        <ConfirmScreen onDone={() => setScreen('profile')} onAccount={() => setScreen('account')} />
      )}
      {screen === 'account' && (
        <AccountScreen
          onBook={(id) => openBooking(id)}
          onReschedule={(bookingId, sid) => openBooking(sid, bookingId)}
          lang={lang}
          onLang={handleLang}
          currency={store.currency}
          onCurrency={setStoreCurrency}
          points={store.points}
          onAwardPoints={awardPoints}
          userName={store.userName}
        />
      )}
      {screen === 'anzh' && <AnzhScreen />}

      <div className="nav-veil" aria-hidden />

      <BottomNav
        current={screen === 'service' ? 'catalog' : screen === 'confirm' ? 'booking' : screen}
        onChange={(s) => {
          if (s === 'booking') openBooking();
          else setScreen(s);
        }}
      />

      <AiChatBubble screen={screen} onBookingNav={() => openBooking()} />

      <SheetHost />
      <LightboxHost />
      <ToastHost />
    </div>
  );
}
