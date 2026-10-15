import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { AiChatBubble } from './components/AiChatBubble';
import { AI_ASSISTANT } from './lib/features';
import { SheetHost, ToastHost, LightboxHost } from './components/UIHost';
import { OfflineBar } from './components/OfflineBar';
import { LangHud } from './components/LangHud';
import { useFabYield } from './lib/fabYield';
import { ProfileScreen } from './screens/ProfileScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { ServiceScreen } from './screens/ServiceScreen';
import { BookingScreen } from './screens/BookingScreen';
import { AccountScreen } from './screens/AccountScreen';
import { AnzhScreen } from './screens/AnzhScreen';
import { ConfirmScreen } from './screens/ConfirmScreen';
import { OnboardingScreen, PolicyReconsent } from './screens/OnboardingScreen';
import { PlanScreen } from './screens/PlanScreen';
import { StudioScreen } from './screens/StudioScreen';
import { closeSheet, openSheet, toast } from './lib/ui';
import { usePolicyReask } from './lib/myData';
import { syncNotificationLanguage } from './lib/notifications';
import { getLang, setLang as setI18nLang } from './lib/i18n';
import type { OnboardingResult } from './screens/OnboardingScreen';
import { getTgUser, initTelegram } from './lib/telegram';
import { g } from './lib/gender';
import { installEdgeSwipeGuard } from './lib/gestures';
import { useHeaderHeight } from './lib/headerHeight';
import { useChrome } from './lib/chrome';
import { initSession, sessionState } from './lib/session';
import { refreshMe, updateMe, useMe, type MePatch } from './lib/api';
import { useCatalogPassive } from './lib/catalog';

const ONB_KEY = 'anzh_onboarded';
const FAV_KEY = 'anzh_favorites_v1';

export interface ClientProfile {
  name: string;
  instagram: string;
  phone: string;
  tgId?: number;
  tgUsername?: string;
}

/* Профиль клиентки больше НЕ хранится на устройстве (`anzh_client_v1`
   вычищается разово, lib/legacyStorage.ts): источник правды — сервер
   (GET/PATCH /me). До ответа сервера — имя из Telegram, только для показа.

   Запасного имени нет. Прежнее запасное имя совпадало с постоянной
   клиенткой из демо-базы, а «мои записи» искались по имени — человек без
   инстаграма видел чужую историю (03-frontend §7 п.9). */
function initialClient(): ClientProfile {
  const tg = getTgUser();
  return {
    name: tg?.firstName ?? '',
    instagram: '',
    phone: '',
    tgId: tg?.id,
    tgUsername: tg?.username,
  };
}

/* Хранилище может быть запрещено (приватный режим, политика WebView) — тогда
   любое обращение бросает. Без try/catch это белый экран на первом же рендере.
   Не прочли отметку — считаем онбординг НЕ пройденным: лишний раз показать
   онбординг безопаснее, чем пропустить согласие с политикой. */
function onboardingDone(): boolean {
  try {
    return !!localStorage.getItem(ONB_KEY);
  } catch {
    return false;
  }
}

function markOnboardingDone(): void {
  try { localStorage.setItem(ONB_KEY, '1'); } catch { /* не запомнится — покажем онбординг снова */ }
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

export type Screen =
  | 'profile' | 'catalog' | 'service' | 'booking' | 'account' | 'anzh' | 'confirm'
  | 'plan' | 'studio';
export type Lang = 'ru' | 'en';

/* `studio` намеренно НЕ в списке восстанавливаемых из адреса: `#studio`
   открывал кабинет мастера мимо PIN — базу клиентов, телефоны и выручку
   видел любой, кто знал хеш. Вход в кабинет только через дверь. */
const VALID_SCREENS: Screen[] = ['profile', 'catalog', 'service', 'booking', 'account', 'anzh', 'confirm', 'plan'];

function initialScreen(): Screen {
  if (typeof window === 'undefined') return 'profile';
  const h = window.location.hash.replace('#', '') as Screen;
  // The address keeps the screen, not the service: "#service" after a reload has no
  // id to show, so it opens the catalog (it used to open a hard-coded demo service).
  if (h === 'service') return 'catalog';
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
  useFabYield();
  const chrome = useChrome();
  const [screen, setScreenRaw] = useState<Screen>(initialScreen);
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [lang, setLang] = useState<Lang>(getLang);
  /* No currency switch (owner's decision B1-B, 06.10.2026): every price is shown in its
     own currency (lib/money.ts), nothing is converted, so there is no app-wide currency. */
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  /* Баллы: механика не решена (контракт §13), экран их скрывает. Здесь —
     только память этого запуска, с нуля. Прежние стартовые 380 и «+50 за
     онбординг» были выдумкой и хранились на устройстве (`anzh_points_v1`
     вычищается разово). */
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [client, setClient] = useState<ClientProfile>(initialClient);
  const { me } = useMe();
  const userName = client.name;
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.hash === '#onboarding') return true;
    // Query param ?seed=1 bypasses onboarding (used for screenshot tests)
    if (window.location.search.includes('seed=1')) return false;
    return !onboardingDone();
  });

  function finishOnboarding(data: OnboardingResult) {
    markOnboardingDone();
    const fallbackName = g('красавица', 'красавчик', data.gender);
    setClient((c) => ({ ...c, name: data.name || fallbackName, instagram: data.instagram, phone: data.phone }));
    setShowOnboarding(false);
    setScreenRaw('profile');
    setTimeout(() => toast(`Добро пожаловать, ${data.name || fallbackName}!`, 'success'), 250);
    saveOnboardingContacts(data);
  }

  /* Контакты из онбординга — на сервер: инстаграм нужен мастеру, это её
     главный ключ к клиентке. Гостю (вне Telegram) сохранять некуда — данные
     живут в памяти этого запуска. Не сохранилось — говорим прямо: иначе
     человек уверен, что мастер его найдёт. */
  function saveOnboardingContacts(data: OnboardingResult) {
    if (sessionState().status === 'guest') return;
    const patch: MePatch = {};
    if (data.name.trim()) patch.first_name = data.name.trim();
    if (data.instagram.trim()) patch.instagram = data.instagram.trim();
    if (data.phone.trim()) patch.phone = data.phone.trim();
    if (Object.keys(patch).length === 0) return;
    // Причину не называем: это может быть и связь, и отказ сервера в формате.
    // Поля «имя / инстаграм» есть в форме записи (BookingScreen) — туда и шлём.
    updateMe(patch).catch(() => {
      const t = {
        ru: 'Контакты не сохранились. Их можно указать при записи.',
        en: 'Contacts were not saved. You can add them when booking.',
      };
      toast(t[getLang()], 'info');
    });
  }

  function skipOnboarding() {
    markOnboardingDone();
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

  /* Вход на сервер при старте — В ФОНЕ. Экран рисуется сразу и не ждёт
     сети: каталог и витрина публичны (и берутся из кэша), а экраны с
     данными человека сами показывают своё «загружается».
     Двойной маунт StrictMode безопасен: initSession/refreshMe отдают одно и
     то же идущее обещание (хранится обещание, а не флажок). */
  useEffect(() => {
    let alive = true;
    const start = () => {
      void initSession().then((s) => {
        if (alive && s === 'user') void refreshMe();
      });
    };
    start();
    // Стартовали без связи — вход повторится, когда она вернётся.
    const onOnline = () => {
      const st = sessionState();
      if (st.status === 'guest' && (st.reason === 'network' || st.reason === 'server')) start();
    };
    window.addEventListener('online', onOnline);
    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  /* Профиль сервера сильнее имени из Telegram: его правит сама клиентка. */
  useEffect(() => {
    if (!me) return;
    setClient((c) => ({
      ...c,
      name: me.first_name ?? c.name,
      instagram: me.instagram ?? c.instagram,
      phone: me.phone ?? c.phone,
      tgId: me.telegram_id,
      tgUsername: me.username ?? c.tgUsername,
    }));
  }, [me]);

  // Telegram выгружает webview при каждом сворачивании — всё, что не записано,
  // теряется. Избранное переживает перезапуск; профиль — на сервере.
  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favorites])); } catch { /* ignore */ }
  }, [favorites]);

  /* K13 (F2): favorites outlive a release (KEPT_KEYS) and may hold ids of the prototype's
     demo rows, now archived — "Saved: N" with no visible heart. On a FRESH server showcase
     the list is cut to what is on it. Not on the bundle or the cache (they may lag behind the
     server), and not on an empty answer: an empty showcase is more likely a moment of the
     data than the end of every procedure, and a cut cannot be undone. The screens count only
     live ids anyway (CatalogScreen, PlanScreen). */
  const catalog = useCatalogPassive();
  useEffect(() => {
    if (catalog.source !== 'server' || catalog.live.length === 0) return;
    const liveIds = new Set(catalog.live.map((s) => s.id));
    setFavorites((prev) => {
      const next = new Set([...prev].filter((id) => liveIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [catalog.source, catalog.live]);

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

  /* Отметка согласия гостя — на прежнюю редакцию политики (lib/myData.ts):
     спросить заново. Не поверх онбординга — там своя галочка. */
  const policyReask = usePolicyReask();
  useEffect(() => {
    if (!policyReask || showOnboarding) return;
    const ru = getLang() === 'ru';
    openSheet({
      title: ru ? 'Политика обновилась' : 'Privacy policy updated',
      body: <PolicyReconsent onDone={closeSheet} />,
    });
  }, [policyReask, showOnboarding]);

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
    /* Язык интерфейса = язык уведомлений бота (PATCH /me {language_code}).
       Плавающий переключатель LangHud меняет его так же, как настройки;
       тот же язык повторно запроса не шлёт. */
    void syncNotificationLanguage(l);
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
          onOpenPlan={() => setScreen('plan')}
        />
      )}
      {screen === 'service' && (
        <ServiceScreen
          serviceId={serviceId ?? ''}
          onBack={() => setScreen('catalog')}
          onBook={(id) => openBooking(id)}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}
      {screen === 'booking' && (
        <BookingScreen
          initialServiceId={serviceId}
          onConfirm={() => setScreen('confirm')}
          onChooseService={() => setScreen('catalog')}
          client={client}
          onClientChange={(patch) => setClient((c) => ({ ...c, ...patch }))}
        />
      )}
      {screen === 'plan' && (
        <PlanScreen
          favorites={favorites}
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
          lang={lang}
          onLang={handleLang}
          points={loyaltyPoints}
          onAwardPoints={(p) => setLoyaltyPoints((x) => x + p)}
          client={client}
          onPlan={() => setScreen('plan')}
          onStudio={() => setScreen('studio')}
        />
      )}
      {screen === 'anzh' && <AnzhScreen onBook={(id) => openBooking(id)} />}

      {/* 🚨 Вуали принадлежат КЛИЕНТСКОМУ хрому и в кабинете вредны.

          Они висят на `.app` с z-index 99 и 199, а `.studio-nav` лежит
          внутри `.screen` (z-index 1) — её собственные 200 действуют
          только внутри экрана. Нижняя вуаль накрывала навигацию
          кабинета целиком: полоса размытия поверх кнопок, из-под
          которой еле проступали иконки.

          У кабинета своя навигация и свои вуали, см. .studio-veil. */}
      {screen !== 'studio' && <div className="header-veil" aria-hidden />}
      {screen !== 'studio' && <div className="nav-veil" aria-hidden />}

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

      {/* The assistant is hidden until it is reworked (owner 06.10) — one switch, lib/features.ts */}
      {screen !== 'studio' && AI_ASSISTANT && (
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
