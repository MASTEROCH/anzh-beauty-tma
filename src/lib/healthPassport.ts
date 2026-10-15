// Паспорт здоровья (анкета) и согласие на данные о здоровье.
//
// ГДЕ ЖИВЁТ ПРАВДА. Анкета — на сервере (GET / PUT / DELETE /me/health),
// согласие — тоже на сервере (`Me.consents.health_data`, POST и DELETE
// /me/consents). На устройстве анкета держится ТОЛЬКО В ПАМЯТИ этого
// запуска: медданные в localStorage больше не пишутся (прежний ключ
// `anzh_health_v1` вычищает lib/legacyStorage.ts, местное согласие
// `anzh_health_consent_v1` — тоже).
//
// Четыре правила, на которых стоит модуль:
//  1. PUT — ПОЛНАЯ замена документа. Сохранять можно только поверх
//     ЗАГРУЖЕННОЙ анкеты: не дочитали (сеть, отказ) — кнопка сохранения
//     выключена. Иначе пустая форма затёрла бы на сервере то, что там есть
//     (умение destructive-after-confirmed-copy: действие — по доказанному
//     состоянию, не по предположению).
//  2. Отсутствие ключа ≠ `false`. Разбор дописывает в анкету только свои
//     поля (цель, опыт, темп, тип кожи, чувствительность) и НЕ пишет
//     «не беременна» от того, что не спрашивал. Признак «человек сам
//     заполнил форму» (`formAt`) восстанавливается по наличию ключа
//     `pregnant` в сохранённом документе.
//  3. Согласие живёт в двух местах (умение consent-state-lives-in-two-places):
//     сервер (`Me.consents.health_data`) и то, что ЭТОТ запуск только что
//     сделал сам (дал / отозвал), пока свежий профиль не пришёл. Второе
//     действует только до прихода нового профиля с сервера.
//  4. Свои данные читать и удалять можно всегда — без флага и без согласия
//     (умение consent-cannot-gate-own-data-access). Флаг `features.health`
//     и согласие запирают только ЗАПИСЬ.
//
// 🔴 Ничего отсюда не пишется в консоль, в журнал, в адрес, в аналитику.

import { useEffect, useSyncExternalStore } from 'react';
import { ApiError, isAbortError, sessionState, subscribeSession } from './session';
import { currentMe, refreshMe, useMe, type Me } from './api';
import { legalVersion, revokeConsent } from './api/me';
import { deleteHealth, getHealth, putHealth, type HealthAnswers, type HealthProfile } from './api/medical';
import { clearQuizResults } from './quizResults';

export type Sensitivity = 'low' | 'medium' | 'high';

export interface HealthPassport {
  noAllergies: boolean;
  allergies: string[];      // свободные пометки клиентки
  pregnant: boolean;
  lactating: boolean;
  chronic: string;
  meds: string;
  skinType: string;         // '' — не указан
  fitzpatrick: string;      // '' — не указан
  couperose: boolean;
  sensitivity: Sensitivity | '';   // '' — не указана
  notes: string;
  updatedAt: number;
  /** Когда клиентка САМА сохранила анкету (а не разбор дописал поля).
      Только после этого незаполненное поле значит «нет», а не «не спрашивали». */
  formAt?: number;
  /* ── Заполняется разбором ANZH Skin Intelligence ── */
  goal?: string;            // главный запрос: сияние / акне / anti-age / губы
  experience?: string;      // с чем уже сталкивалась
  pace?: string;            // разовая процедура / курс / системно
  quizAt?: number;          // когда проходили разбор
}

/* ПУСТАЯ анкета. Ничего не указано — значит ничего не утверждаем: здесь
   когда-то стояли заготовленные аллергия, тип кожи и фототип, и каждая
   новая клиентка «имела» аллергию, которой не указывала. */
const DEFAULT: HealthPassport = {
  noAllergies: false,
  allergies: [],
  pregnant: false,
  lactating: false,
  chronic: '',
  meds: '',
  skinType: '',
  fitzpatrick: '',
  couperose: false,
  sensitivity: '',
  notes: '',
  updatedAt: 0,
};

/* ── Состояние (в памяти) ─────────────────────────────────────────── */

/**
 * 'idle'    — не читали (гость или вход ещё идёт);
 * 'loading' — читаем с сервера;
 * 'ready'   — прочитали (в том числе «анкеты нет»);
 * 'error'   — прочитать не удалось: это НЕ «анкета пустая».
 */
export type HealthLoad = 'idle' | 'loading' | 'ready' | 'error';

export interface HealthState {
  passport: HealthPassport;
  load: HealthLoad;
  error: ApiError | null;
  /** На сервере лежит сохранённая анкета */
  hasServerDoc: boolean;
}

let hs: HealthState = { passport: DEFAULT, load: 'idle', error: null, hasServerDoc: false };
/** Последний документ сервера — база для дописки полей разбора. */
let serverAnswers: HealthAnswers | null = null;
/** Идущее чтение — обещание, а не флажок (двойной маунт StrictMode). */
let loading: Promise<void> | null = null;

const listeners = new Set<() => void>();
function emit(): void {
  for (const l of listeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}
function setHs(next: HealthState): void {
  hs = next;
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isSens = (v: unknown): v is Sensitivity => v === 'low' || v === 'medium' || v === 'high';

/** Документ сервера → анкета экрана. */
function fromServer(h: HealthProfile | null): HealthPassport {
  if (!h || typeof h.answers !== 'object' || h.answers === null) return DEFAULT;
  const a = h.answers;
  const at = Date.parse(h.updated_at);
  const when = Number.isFinite(at) ? at : Date.now();
  const fromQuiz = !!(a.goal || a.experience || a.pace);
  return {
    noAllergies: a.noAllergies === true,
    allergies: Array.isArray(a.allergies) ? a.allergies.filter((x): x is string => typeof x === 'string') : [],
    pregnant: a.pregnant === true,
    lactating: a.lactating === true,
    chronic: str(a.chronic),
    meds: str(a.meds),
    skinType: str(a.skinType),
    fitzpatrick: str(a.fitzpatrick),
    couperose: a.couperose === true,
    sensitivity: isSens(a.sensitivity) ? a.sensitivity : '',
    notes: str(a.notes),
    updatedAt: when,
    // Форму отвечала сама — только если в документе есть ответ про беременность
    formAt: typeof a.pregnant === 'boolean' ? when : undefined,
    goal: a.goal || undefined,
    experience: a.experience || undefined,
    pace: a.pace || undefined,
    quizAt: fromQuiz ? when : undefined,
  };
}

function applyServer(h: HealthProfile | null): void {
  serverAnswers = h?.answers ?? null;
  setHs({ passport: fromServer(h), load: 'ready', error: null, hasServerDoc: !!h });
}

function asApiError(e: unknown, what: string): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(0, isAbortError(e) ? 'aborted' : 'network', `${what}: сбой`);
}

/**
 * Прочитать анкету с сервера (один раз за вход; `force` — перечитать).
 * Не бросает: отказ ложится в `error`, и экран говорит «не удалось
 * загрузить», а не рисует пустую форму.
 */
export function ensureHealthLoaded(force = false): Promise<void> {
  if (sessionState().status !== 'user') return Promise.resolve();
  if (loading) return loading;
  if (hs.load === 'ready' && !force) return Promise.resolve();
  setHs({ ...hs, load: 'loading', error: null });
  loading = getHealth()
    .then(
      (h) => {
        // Разбор, пройденный пока шла загрузка, не теряем: его поля — поверх
        const mem = hs.passport;
        applyServer(h);
        if (mem.quizAt && !hs.passport.quizAt) {
          setHs({
            ...hs,
            passport: {
              ...hs.passport,
              goal: mem.goal, experience: mem.experience, pace: mem.pace,
              sensitivity: hs.passport.sensitivity || mem.sensitivity,
              skinType: hs.passport.skinType || mem.skinType,
              quizAt: mem.quizAt,
            },
          });
        }
      },
      (e: unknown) => setHs({ ...hs, load: 'error', error: asApiError(e, 'GET /me/health') }),
    )
    .finally(() => { loading = null; });
  return loading;
}

/** Стереть анкету с устройства: память этого запуска и следы прежних версий. */
export function wipeHealthOnDevice(): void {
  serverAnswers = null;
  setHs({
    passport: DEFAULT,
    load: sessionState().status === 'user' ? 'ready' : 'idle',
    error: null,
    hasServerDoc: false,
  });
  try {
    localStorage.removeItem('anzh_health_v1');
    localStorage.removeItem('anzh_health_consent_v1');
  } catch { /* хранилище запрещено — стирать нечего */ }
}

// Вошли — прочитать анкету, но ТОЛЬКО если её уже ждёт открытый экран:
// медданные не тянутся «на всякий случай» при каждом запуске (экран,
// которому анкета нужна, сам зовёт загрузку при монтировании).
// Стали гостем — чужую анкету не показывать.
subscribeSession(() => {
  const s = sessionState().status;
  if (s === 'user') {
    if (listeners.size > 0) void ensureHealthLoaded();
  } else if (s === 'guest' && (hs.hasServerDoc || hs.load !== 'idle')) {
    serverAnswers = null;
    setHs({ passport: DEFAULT, load: 'idle', error: null, hasServerDoc: false });
  }
});

/** Анкета для экранов (память + сервер). Загрузку запускает сама. */
export function useHealthPassport(): HealthPassport {
  return useHealthState().passport;
}

/** Анкета с состоянием загрузки — для экранов, которым важно «ошибка ≠ пустота». */
export function useHealthState(): HealthState {
  const s = useSyncExternalStore(subscribe, () => hs, () => hs);
  useEffect(() => { void ensureHealthLoaded(); }, []);
  return s;
}

/**
 * Поправить анкету В ПАМЯТИ (без сервера). Сохранение на сервер —
 * `saveHealthForm` (форма) или `saveQuizToPassport` (разбор).
 */
export function updateHealthPassport(patch: Partial<HealthPassport>): void {
  setHs({ ...hs, passport: { ...hs.passport, ...patch } });
}

/** Прежнее имя «стереть анкету с устройства». */
export const clearHealthPassport = wipeHealthOnDevice;

/* ── Анкета → провод ──────────────────────────────────────────────── */

function putText(a: HealthAnswers, k: 'chronic' | 'meds' | 'skinType' | 'fitzpatrick' | 'notes' | 'goal' | 'experience' | 'pace', v: string | undefined): void {
  const t = (v ?? '').trim();
  if (t) a[k] = t;
}

/** Всё, что человек ответил в форме. Длины не режем молча: лишнее — 422 и слова на экране. */
function formAnswers(p: HealthPassport): HealthAnswers {
  const a: HealthAnswers = {
    noAllergies: p.noAllergies,
    pregnant: p.pregnant,
    lactating: p.lactating,
    couperose: p.couperose,
  };
  if (!p.noAllergies) {
    const list = p.allergies.map((x) => x.trim()).filter(Boolean);
    if (list.length) a.allergies = list;
  }
  putText(a, 'chronic', p.chronic);
  putText(a, 'meds', p.meds);
  putText(a, 'skinType', p.skinType);
  putText(a, 'fitzpatrick', p.fitzpatrick);
  putText(a, 'notes', p.notes);
  putText(a, 'goal', p.goal);
  putText(a, 'experience', p.experience);
  putText(a, 'pace', p.pace);
  if (p.sensitivity) a.sensitivity = p.sensitivity;
  return a;
}

/** Поля, которые пишет разбор, — и только они. */
function quizAnswers(p: Partial<HealthPassport>): HealthAnswers {
  const a: HealthAnswers = {};
  putText(a, 'goal', p.goal);
  putText(a, 'experience', p.experience);
  putText(a, 'pace', p.pace);
  putText(a, 'skinType', p.skinType);
  if (p.sensitivity) a.sensitivity = p.sensitivity;
  return a;
}

/**
 * Сохранить анкету из формы (PUT /me/health). Бросает ApiError — экран
 * обязан сказать, что не сохранилось. Согласие даётся ОТДЕЛЬНЫМ шагом до
 * этого вызова (HealthPassportSheet: POST /me/consents на редакцию
 * `Me.legal.health_data`), а не «заодно».
 */
export async function saveHealthForm(p: HealthPassport): Promise<void> {
  if (sessionState().status !== 'user') throw new ApiError(401, 'no_session', 'PUT /me/health: нет входа');
  if (hs.load !== 'ready') throw new ApiError(0, 'not_loaded', 'PUT /me/health: анкета не дочитана');
  try {
    applyServer(await putHealth(formAnswers(p)));
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'consent_required' || e.code === 'feature_disabled')) {
      void refreshMe(); // правда о согласии и флаге — у сервера
    }
    throw e;
  }
}

export type QuizSave = 'saved' | 'kept_local' | 'failed';

/**
 * Разбор дописывает свои поля в анкету. В памяти — всегда (экран видит
 * сразу). На сервер — только при входе, включённом флаге и ДЕЙСТВУЮЩЕМ
 * согласии; иначе 'kept_local' (живёт до закрытия приложения).
 */
export async function saveQuizToPassport(patch: Partial<HealthPassport>): Promise<QuizSave> {
  updateHealthPassport(patch);
  if (sessionState().status !== 'user') return 'kept_local';
  const me = currentMe();
  if (me?.features?.health !== true || !consentFor(me)) return 'kept_local';
  if (hs.load !== 'ready') await ensureHealthLoaded();
  if (hs.load !== 'ready') return 'failed';
  const answers = quizAnswers(patch);
  if (Object.keys(answers).length === 0) return 'kept_local';
  try {
    const mem = hs.passport;
    applyServer(await putHealth({ ...(serverAnswers ?? {}), ...answers }));
    if (mem.quizAt) setHs({ ...hs, passport: { ...hs.passport, quizAt: mem.quizAt } });
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Стереть только анкету (DELETE /me/health), согласие не трогать. */
export async function deleteHealthData(): Promise<void> {
  await deleteHealth();
  wipeHealthOnDevice();
}

/* ── Согласие на данные о здоровье (правда — сервер) ──────────────── */

export interface HealthConsent {
  /** Когда дано — если этот запуск знает (сервер в Me отдаёт только «да/нет») */
  grantedAt: number | null;
  /** Версия текста, на которую дано */
  version: string | null;
}

/* Что этот запуск только что сделал сам. Действует, пока с сервера не
   пришёл НОВЫЙ профиль (другой объект Me): дальше правда — его. */
let own: { kind: 'granted' | 'revoked'; at: number; version: string | null; meRef: Me | null } | null = null;
let consentTick = 0;
function bumpConsent(): void {
  consentTick += 1;
  emit();
}

function consentFor(me: Me | null): HealthConsent | null {
  if (own && me === own.meRef) {
    return own.kind === 'granted' ? { grantedAt: own.at, version: own.version } : null;
  }
  const server = me?.consents?.health_data;
  if (server === true) {
    // Согласие в Me.consents — на ТЕКУЩУЮ редакцию; её номер — Me.legal.health_data
    return { grantedAt: own?.kind === 'granted' ? own.at : null, version: legalVersion(me, 'health_data') };
  }
  // Сервер не прислал поле вовсе (старый ответ) — опираемся на своё действие
  if (server === undefined && own?.kind === 'granted') return { grantedAt: own.at, version: own.version };
  return null;
}

/** Действующее согласие на данные о здоровье или `null`. */
export function useHealthConsent(): HealthConsent | null {
  const { me } = useMe();
  useSyncExternalStore(subscribe, () => consentTick, () => consentTick);
  return consentFor(me);
}

/* Здесь был grantHealthConsent(): после волны 2 его никто не вызывал —
   HealthPassportSheet даёт согласие сам (grantConsent на Me.legal.health_data,
   409 version_mismatch → новая редакция и галочка заново), а второй путь к
   той же двери, читавший прежнее Me.policy_version, мог только разойтись с
   первым. */

/**
 * Отозвать согласие (DELETE /me/consents/health_data). Сервер в той же
 * транзакции стирает анкету; здесь — стираем её и на устройстве.
 * Бросает ApiError: пока сервер не подтвердил, на устройстве ничего не стираем.
 */
export async function revokeHealthConsent(): Promise<{ wiped: boolean }> {
  const r = await revokeConsent('health_data');
  wipeHealthOnDevice();
  clearQuizResults(); // текст согласия обещает: «анкета и сохранённые разборы будут стёрты»
  own = { kind: 'revoked', at: Date.now(), version: null, meRef: currentMe() };
  bumpConsent();
  void refreshMe();
  return { wiped: r?.health_wiped === true };
}

/** Забыть свои действия с согласием (удаление аккаунта). */
export function forgetHealthConsent(): void {
  own = null;
  bumpConsent();
}

/* Ключ '' — «не указана»: чувствительность в пустой анкете не выдумываем,
   а экраны, которые читают подпись напрямую, получают честное «не указана». */
export const SENSITIVITY_LABEL: Record<Sensitivity | '', { ru: string; en: string }> = {
  '':     { ru: 'Не указана', en: 'Not set' },
  low:    { ru: 'Низкая',  en: 'Low' },
  medium: { ru: 'Средняя', en: 'Medium' },
  high:   { ru: 'Высокая', en: 'High' },
};

export const SKIN_TYPES = ['Сухая', 'Нормальная', 'Комбинированная', 'Жирная', 'Чувствительная'];
export const FITZPATRICK = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Флаги для карточки в кабинете и для сверки с противопоказаниями услуги.
 *
 *  Зелёная галочка — утверждение о здоровье человека, поэтому ставится
 *  только на то, что человек сам сказал. Раньше пустая анкета давала
 *  «Без аллергий» и «Не беременна · без хроник» — то есть молчание
 *  читалось мастером как «безопасно». */
export function passportFlags(p: HealthPassport, ru = true) {
  const flags: Array<{ kind: 'warn' | 'ok'; text: string }> = [];
  if (p.allergies.length > 0 && !p.noAllergies) {
    p.allergies.forEach((a) => flags.push({ kind: 'warn', text: a }));
  } else if (p.noAllergies) {
    flags.push({ kind: 'ok', text: ru ? 'Без аллергий' : 'No allergies' });
  }
  if (p.pregnant) flags.push({ kind: 'warn', text: ru ? 'Беременность' : 'Pregnancy' });
  if (p.lactating) flags.push({ kind: 'warn', text: ru ? 'Лактация' : 'Lactation' });
  if (p.chronic.trim()) flags.push({ kind: 'warn', text: p.chronic.trim() });
  if (p.meds.trim()) flags.push({ kind: 'warn', text: (ru ? 'Препараты: ' : 'Meds: ') + p.meds.trim() });
  if (p.formAt && !p.pregnant && !p.lactating && !p.chronic.trim()) {
    flags.push({ kind: 'ok', text: ru ? 'Не беременна · без хроник' : 'Not pregnant · no chronic' });
  }
  if (flags.length === 0) {
    flags.push({ kind: 'warn', text: ru ? 'Анкета не заполнена' : 'Questionnaire not filled in' });
  }
  return flags;
}

/** Совпадения анкеты с противопоказаниями конкретной услуги */
export function matchContraindications(p: HealthPassport, contraindications: string[]): string[] {
  const hits: string[] = [];
  for (const c of contraindications) {
    const low = c.toLowerCase();
    if (p.pregnant && /беремен|pregnan/.test(low)) hits.push(c);
    else if (p.lactating && /лактац|кормл|lactat/.test(low)) hits.push(c);
    else if (p.couperose && /купероз/.test(low)) hits.push(c);
    else if (!p.noAllergies && p.allergies.some((a) => {
      const word = a.toLowerCase().split(/[\s—-]/)[0];
      return word.length > 3 && low.includes(word);
    })) hits.push(c);
  }
  return hits;
}
