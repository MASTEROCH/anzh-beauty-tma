import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { AiChatBubble } from './components/AiChatBubble';
import { SheetHost, ToastHost, LightboxHost } from './components/UIHost';
import { OfflineBar } from './components/OfflineBar';
import { LangHud } from './components/LangHud';
import { ProfileScreen } from './screens/ProfileScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { ServiceScreen } from './screens/ServiceScreen';
import { BookingScreen } from './screens/BookingScreen';
import { AccountScreen } from './screens/AccountScreen';
import { AnzhScreen } from './screens/AnzhScreen';
import { ConfirmScreen } from './screens/ConfirmScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PlanScreen } from './screens/PlanScreen';
import { StudioScreen } from './screens/StudioScreen';
import { toast } from './lib/ui';
import { getLang, setLang as setI18nLang } from './lib/i18n';
import type { OnboardingResult } from './screens/OnboardingScreen';
import { getTgUser, initTelegram } from './lib/telegram';
import { g } from './lib/gender';
import { installEdgeSwipeGuard } from './lib/gestures';
import { useHeaderHeight } from './lib/headerHeight';
import { useChrome } from './lib/chrome';

const ONB_KEY = 'anzh_onboarded';
const FAV_KEY = 'anzh_favorites_v1';
const POINTS_KEY = 'anzh_points_v1';
const CLIENT_KEY = 'anzh_client_v1';

export interface ClientProfile {
  name: string;
  instagram: string;
  phone: string;
  tgId?: number;
  tgUsername?: string;
}

function loadClient(): ClientProfile {
  const tg = getTgUser();
  const fallback: ClientProfile = {
    name: tg?.firstName ?? 'Маша',
    instagram: '',
    phone: '',
    tgId: tg?.id,
    tgUsername: tg?.username,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(CLIENT_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<ClientProfile>) } : fallback;
  } catch {
    return fallback;
  }
}

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function loadPoints(): number {
  if (typeof window === 'undefined') return 380;
  const raw = localStorage.getItem(POINTS_KEY);
  return raw ? Number(raw) || 0 : 380;
}

export type Screen =
  | 'profile' | 'catalog' | 'service' | 'booking' | 'account' | 'anzh' | 'confirm'
  | 'plan' | 'studio';
export type Lang = 'ru' | 'en';
export type Currency = 'usd' | 'gel';

/* `studio` намеренно НЕ в списке восстанавливаемых из адреса: `#studio`
   открывал кабинет мастера мимо PIN — базу клиентов, телефоны и выручку
   видел любой, кто знал хеш. Вход в кабинет только через дверь. */
const VALID_SCREENS: Screen[] = ['profile', 'catalog', 'service', 'booking', 'account', 'anzh', 'confirm', 'plan'];

function initialScreen(): Screen {
  if (typeof window === 'undefined') return 'profile';
  const h = window.location.hash.replace('#', '') as Screen;
  return VALID_SCREENS.includes(h) ? h : 'profile';
}

function navigate(setter: () => void) {
  const d = document as Document & {
    startViewTransition?: (cb: () => void) => { finished?: Promise<void>; ready?: Promise<void> };
  };
  if (typeof d.startViewTransition !== 'function') { setter(); return; }
  // Быстрые тапы по вкладкам прерывают предыдущий переход, и он отклоняет свой
  // промис: без catch это необработанное отклонение в консоли у каждого,
  // кто листает быстро. Сам переход при этом отрабатывает штатно.
  const tr = d.startViewTransition(setter);
  tr?.finished?.catch(() => {});
  tr?.ready?.catch(() => {});
}

export function App() {
  useHeaderHeight();
  const chrome = useChrome();
  const [screen, setScreenRaw] = useState<Screen>(initialScreen);
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [lang, setLang] = useState<Lang>(getLang);
  const [currency, setCurrency] = useState<Currency>('usd');
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [loyaltyPoints, setLoyaltyPoints] = useState(loadPoints);
  const [client, setClient] = useState<ClientProfile>(loadClient);
  const userName = client.name;
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.hash === '#onboarding') return true;
    // Query param ?seed=1 bypasses onboarding (used for screenshot tests)
    if (window.location.search.includes('seed=1')) return false;
    return !localStorage.getItem(ONB_KEY);
  });

  function finishOnboarding(data: OnboardingResult) {
    localStorage.setItem(ONB_KEY, '1');
    const fallbackName = g('красавица', 'красавчик', data.gender);
    setClient((c) => ({ ...c, name: data.name || fallbackName, instagram: data.instagram, phone: data.phone }));
    setLoyaltyPoints((p) => p + 50);
    setShowOnboarding(false);
    setScreenRaw('profile');
    setTimeout(() => toast(`Добро пожаловать, ${data.name || fallbackName}! +50 баллов на старт`, 'success'), 250);
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

  useEffect(() => {
    initTelegram();
    // Свайп от края в iOS WebKit = «назад» = закрыть мини-апп вместе с
    // несохранённым вводом. Официального API нет, гасим жест руками.
    return installEdgeSwipeGuard();
  }, []);

  // Telegram выгружает webview при каждом сворачивании — всё, что не записано,
  // теряется. Избранное, баллы и профиль переживают перезапуск.
  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favorites])); } catch { /* ignore */ }
  }, [favorites]);
  useEffect(() => {
    try { localStorage.setItem(POINTS_KEY, String(loyaltyPoints)); } catch { /* ignore */ }
  }, [loyaltyPoints]);
  useEffect(() => {
    try { localStorage.setItem(CLIENT_KEY, JSON.stringify(client)); } catch { /* ignore */ }
  }, [client]);

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
    setI18nLang(l);
    toast(l === 'ru' ? 'Язык: русский' : 'Language: English', 'success');
  };

  if (showOnboarding) {
    return (
      <div className="app">
        <div className="app-orbs" aria-hidden />
        <OnboardingScreen onComplete={finishOnboarding} onSkip={skipOnboarding} />
        <OfflineBar />
        <ToastHost />
      </div>
    );
  }

  return (
    <div className={`app${chrome.hidden ? ' chrome-away' : ''}${chrome.scrolling ? ' is-scrolling' : ''}`}>
      <div className="app-orbs" aria-hidden />
      {screen === 'profile' && (
        <ProfileScreen
          onBook={(id) => openBooking(id)}
          onCatalog={() => setScreen('catalog')}
          onOpenService={openService}
          lang={lang}
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
          onOpenPlan={() => setScreen('plan')}
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
          client={client}
          onClientChange={(patch) => setClient((c) => ({ ...c, ...patch }))}
        />
      )}
      {screen === 'plan' && (
        <PlanScreen
          favorites={favorites}
          currency={currency}
          onBack={() => setScreen('catalog')}
          onBook={(id) => openBooking(id)}
          onCatalog={() => setScreen('catalog')}
        />
      )}
      {screen === 'studio' && <StudioScreen onExit={() => setScreen('account')} />}
      {screen === 'confirm' && (
        <ConfirmScreen onDone={() => setScreen('profile')} onAccount={() => setScreen('account')} />
      )}
      {screen === 'account' && (
        <AccountScreen
          onBook={() => openBooking()}
          onBookAgain={(id) => openBooking(id)}
          onReschedule={() => openBooking(serviceId ?? 'lip-filler')}
          lang={lang}
          onLang={handleLang}
          currency={currency}
          onCurrency={setCurrency}
          points={loyaltyPoints}
          onAwardPoints={(p) => setLoyaltyPoints((x) => x + p)}
          client={client}
          onPlan={() => setScreen('plan')}
          onStudio={() => setScreen('studio')}
        />
      )}
      {screen === 'anzh' && <AnzhScreen onBook={(id) => openBooking(id)} />}

      <div className="header-veil" aria-hidden />
      <div className="nav-veil" aria-hidden />

      {screen !== 'studio' && (
        <BottomNav
          current={
            screen === 'service' || screen === 'confirm' || screen === 'plan' ? 'catalog' : screen
          }
          onChange={(s) => {
            if (s === 'booking') openBooking();
            else setScreen(s);
          }}
        />
      )}

      {screen !== 'studio' && <LangHud lang={lang} onLang={handleLang} />}

      {screen !== 'studio' && (
        <AiChatBubble
          screen={screen}
          onBookingNav={(id) => openBooking(id)}
          onOpenService={openService}
          onOpenCatalog={() => setScreen('catalog')}
          onOpenPlan={() => setScreen('plan')}
        />
      )}

      <OfflineBar />
      <SheetHost />
      <LightboxHost />
      <ToastHost />
    </div>
  );
}
