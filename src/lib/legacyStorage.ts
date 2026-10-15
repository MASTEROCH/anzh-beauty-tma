// Разовая чистка localStorage при первом запуске версии, которая ходит на сервер.
//
// ЧТО УБИРАЕМ. Ключи, чьё содержимое уехало на сервер или опасно само по себе
// (разведка 03-frontend §1, решение 11b-sanya-revise m8):
//   · anzh_staff_v1 — команда с PIN ОТКРЫТЫМ ТЕКСТОМ;
//   · anzh_health_v1 — анкета здоровья (медданные) с выдуманной «аллергией» по умолчанию;
//   · деньги, записи, разборы, баллы, профиль, общие данные команды — теперь их
//     источник сервер, а локальная копия с ним разойдётся и будет врать.
//
// ЧТО ОСТАЁТСЯ. Личное и безвредное: онбординг пройден, избранное, пол для
// окончаний, язык, отметка «принял политику до входа» и копия публичной
// витрины (её источник — сервер, копия лишь рисует каталог без сети).
// Валюта показа живёт только в памяти.
//
// 🔴 ЭТО НЕ ПЕРЕНОС, А ОТКАЗ ОТ ЛОКАЛЬНЫХ ДАННЫХ. На сервер отсюда ничего не
// заливается: в прототипе там демо-наполнение и заполненные по умолчанию поля,
// перенос размножил бы выдумку в боевой базе. Решение плана, не недосмотр.
//
// 🔴 ПОРЯДОК ЗАПУСКА ВАЖЕН. Модули-хранилища (appointments, staff, healthPassport…)
// читают свой ключ В ТЕЛЕ МОДУЛЯ, при импорте, держат копию в памяти и при
// первом же изменении пишут её обратно. Чистка, вызванная из эффекта App,
// опоздала бы: старый PIN вернулся бы в хранилище из памяти. Поэтому чистка
// выполняется при импорте ЭТОГО модуля, а `main.tsx` импортирует его раньше
// App и всего его дерева (ESM выполняет импорты по порядку). Впереди стоит
// только lib/bootGuard.ts — он хранилище лишь читает и копий не держит.
//
// ОДИН РАЗ. После чистки ставится метка версии. Метка сравнивается на РАВЕНСТВО,
// не «меньше»: версия — строка, и числовое сравнение строк врёт. Метка ставится
// ПОСЛЕ удаления: если вкладку закрыли посреди, следующий запуск дочистит.

export const STORAGE_VERSION_KEY = 'anzh_storage_version';
/** Поднять, если в список добавятся ключи: чистка пройдёт ещё раз (удаление повторяемо). */
// server-1 — волна 0; server-2 — волна 1 добавила anzh_reviews_v1 (демо-отзывы прежнего reviews.ts).
export const STORAGE_VERSION = 'server-2';

/** Ключи, которые уходят. Порядок — по таблице 03 §1. */
export const LEGACY_KEYS: readonly string[] = [
  'anzh_client_v1',            // профиль: имя, инстаграм, телефон → сервер (PATCH /me)
  'anzh_points_v1',            // баллы (по умолчанию фальшивые 380) → сервер / скрыты
  'anzh_appointments_v2',      // записи, 38 демо → сервер
  'anzh_plan_v1',              // статус плана (само-«согласование» через 45 с)
  'anzh_health_v1',            // анкета здоровья — медданные
  'anzh_quiz_results_v1',      // результаты разборов → сервер
  'anzh_purchases_v1',         // купленные разборы → сервер (только по оплате)
  'anzh_quests_v1',            // задания → сервер
  'anzh_bonuses_v1',           // бонусы-промокоды → убраны
  'anzh_notifications_v1',     // тумблеры напоминаний → сервер (Me.notifications)
  'anzh_health_consent_v1',    // местное согласие на здоровье (волна 0) → сервер (Me.consents.health_data)
  'anzh_prices_v1',            // правки цен владелицы → сервер
  'anzh_custom_services_v1',   // добавленные процедуры → сервер
  'anzh_archived_services_v1', // архив процедур → сервер
  'anzh_client_notes_v1',      // заметки мастера о клиентках → сервер
  'anzh_staff_v1',             // команда с PIN открытым текстом
  'anzh_staff_session_v1',     // «кто вошёл в кабинет» — роль даёт сервер
  'anzh_chats_v1',             // переписка, 3 демо
  'anzh_promos_v1',            // акции, демо
  'anzh_reviews_v1',           // 6 демо-отзывов прежнего reviews.ts → сервер (волна 1, Ф-2)
];

/** Ключи, которые остаются на устройстве. Чистка их не трогает. */
export const KEPT_KEYS: readonly string[] = [
  'anzh_onboarded',
  'anzh_favorites_v1',
  'anzh_gender_v1',
  'anzh_lang',
  'anzh_policy_pending_v1',    // «принял политику до входа» — уходит на сервер после входа (lib/myData.ts)
  'anzh_catalog_cache_v1',     // копия публичной витрины GET /services (lib/catalog.ts) — не личное, не медданные
];

export interface CleanupResult {
  /** Чистка выполнялась в этом запуске (метки не было или она старая). */
  ran: boolean;
  /** Какие ключи реально лежали и удалены. */
  removed: string[];
  /** Хранилище недоступно или удаление отказало — метка НЕ поставлена. */
  failed: boolean;
}

/** Мини-интерфейс хранилища — чтобы тест подсовывал своё. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // доступ к хранилищу запрещён (режим приватности, политика WebView)
  }
}

export function cleanLegacyStorage(storage: StorageLike | null = browserStorage()): CleanupResult {
  if (!storage) return { ran: false, removed: [], failed: true };
  try {
    if (storage.getItem(STORAGE_VERSION_KEY) === STORAGE_VERSION) {
      return { ran: false, removed: [], failed: false };
    }
    const removed: string[] = [];
    for (const key of LEGACY_KEYS) {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        removed.push(key);
      }
    }
    // Проверка перечитыванием, а не верой в removeItem: метка ставится,
    // только если хранилище действительно пусто по списку.
    if (LEGACY_KEYS.some((k) => storage.getItem(k) !== null)) {
      return { ran: true, removed, failed: true };
    }
    storage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    return { ran: true, removed, failed: false };
  } catch {
    return { ran: true, removed: [], failed: true };
  }
}

/** Выполняется при импорте — см. «ПОРЯДОК ЗАПУСКА» выше. */
export const legacyCleanup: CleanupResult = cleanLegacyStorage();
