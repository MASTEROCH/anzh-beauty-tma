// «Мои данные»: выгрузка, удаление аккаунта, общий замок деструктивных
// дверей и согласие с политикой, данное до входа.
//
// Правила:
//  · ОДИН замок на все деструктивные двери (удалить аккаунт, отозвать
//    согласие на здоровье, удалить анкету) — умение
//    destructive-after-confirmed-copy §4: пока одна дверь работает, другие
//    не нажимаются, итог не зависит от гонки двух нажатий.
//  · Устройство чистится ТОЛЬКО после ответа сервера «удалено»: сеть упала —
//    на устройстве ничего не стёрто, человек видит «не удалось».
//  · Согласие с политикой: гость (или вход ещё идёт) отмечает его локально,
//    на сервер оно уходит после входа — POST /me/consents {kind:'policy',
//    version, lang}. Локально хранятся время, ВИДЕННАЯ редакция и язык.
//    Уходит, только если виденная редакция = текущей (Me.legal.policy);
//    иначе согласие спрашивается заново (решение John перед волной 3).
//
// 🔴 Выгрузка содержит анкету здоровья: её тело не пишется ни в консоль, ни в
// журнал — только в файл, который человек сам скачивает.

import { useSyncExternalStore } from 'react';
import { ApiError, sessionState, subscribeSession } from './session';
import { currentMe, refreshMe } from './api';
import { deleteMe, exportMe, grantConsent, hasConsent, isVersionMismatch, legalVersion } from './api/me';
import { getLang, type Lang } from './i18n';
import { isTelegram } from './telegram';
import { forgetHealthConsent, wipeHealthOnDevice } from './healthPassport';
import { resetPurchases } from './payments';
import { clearQuizResults } from './quizResults';

/* ── Замок деструктивных дверей ───────────────────────────────────── */

let busy = false;
const lockListeners = new Set<() => void>();

function setBusy(v: boolean): void {
  busy = v;
  for (const l of lockListeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}

/** Занята ли хоть одна деструктивная дверь — все кнопки деструктива гаснут. */
export function useDestructiveBusy(): boolean {
  return useSyncExternalStore(
    (l) => { lockListeners.add(l); return () => { lockListeners.delete(l); }; },
    () => busy,
    () => busy,
  );
}

/**
 * Выполнить деструктив под общим замком. Замок занят — отказ `busy` без
 * похода в сеть (второе нажатие, пока первое идёт, — не второй запрос).
 */
export async function withDestructiveLock<T>(fn: () => Promise<T>): Promise<T> {
  if (busy) throw new ApiError(0, 'busy', 'деструктив уже выполняется');
  setBusy(true);
  try {
    return await fn();
  } finally {
    setBusy(false);
  }
}

/* ── Выгрузка ─────────────────────────────────────────────────────── */

/**
 * GET /me/export → файл JSON на устройство. Возвращает имя файла.
 * Бросает ApiError (429 — лимит 5 раз в час).
 *
 * ⚠️ Скачивание через `blob:` в WebView Telegram работает не везде
 * (Android WebView его не сохраняет). Надёжный путь — одноразовая ссылка
 * с сервера и `WebApp.downloadFile`; это заявка на сервер, не этой ночью.
 */
export async function downloadMyData(): Promise<string> {
  const data = await exportMe();
  const day = new Date().toISOString().slice(0, 10);
  const name = `anzh-my-data-${day}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Ссылку отпускаем не сразу: браузеру нужно время начать скачивание
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return name;
}

/* ── Удаление аккаунта ────────────────────────────────────────────── */

/**
 * Стереть с устройства всё, что приложение там держит: ключи `anzh_*` в
 * хранилищах и память этого запуска (анкета, согласие, разборы, покупки).
 */
export function wipeDevice(): void {
  wipeHealthOnDevice();
  forgetHealthConsent();
  clearQuizResults();
  resetPurchases();
  for (const store of [safeStorage('local'), safeStorage('session')]) {
    if (!store) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith('anzh_')) keys.push(k);
      }
      for (const k of keys) store.removeItem(k);
    } catch { /* хранилище запрещено — стирать нечего */ }
  }
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * DELETE /me {confirm:'DELETE'}. Слово в теле — защита от случайного вызова,
 * а не подтверждение человека: окно подтверждения — на экране. Устройство
 * чистится только после `{deleted:true}` от сервера. Бросает ApiError.
 */
export async function deleteAccount(): Promise<void> {
  const r = await deleteMe();
  if (!r || r.deleted !== true) throw new ApiError(200, 'bad_response', 'DELETE /me: нет deleted:true');
  wipeDevice();
}

/**
 * После удаления аккаунта — закрыть мини-приложение. НЕ перезагружать внутри
 * Telegram: перезапуск заново войдёт по initData и мог бы тут же завести
 * профиль, который человек только что удалил.
 */
export function closeApp(): void {
  const tg = (window as unknown as { Telegram?: { WebApp?: { close?: () => void } } }).Telegram?.WebApp;
  if (isTelegram() && typeof tg?.close === 'function') {
    tg.close();
    return;
  }
  window.location.reload();
}

/* ── Согласие с политикой: локально до входа, на сервер после ─────── */

/**
 * Редакция политики, которую видит ГОСТЬ: мета `legal-version` в
 * `public/legal/privacy.html` ЭТОЙ сборки (тексты и код выкладываются
 * вместе; реестр сервера берёт версию из той же меты — tools/legal-registry.mjs).
 * Вошедший видит `Me.legal.policy`. Сторож расхождения с файлом —
 * tests/smoke/f1-me.spec.ts, «онбординг гостем».
 */
export const BUNDLED_POLICY_VERSION = '2026-10-15-draft5';

/** Отметка «человек принял политику, сервер ещё не знает»: время, виденная редакция, язык. */
export const POLICY_PENDING_KEY = 'anzh_policy_pending_v1';

interface PendingPolicy {
  at: number;
  /** Редакция, которую человек видел, отмечая галочку; `null` — неизвестна (отметка старой сборки). */
  version: string | null;
  /** Язык интерфейса, на котором он её видел. */
  lang: Lang;
}

function readPending(): PendingPolicy | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(POLICY_PENDING_KEY); } catch { return null; }
  if (!raw) return null;
  let v: { at?: unknown; version?: unknown; lang?: unknown } | null = null;
  try { v = JSON.parse(raw); } catch { /* испорченная отметка — редакция неизвестна */ }
  return {
    at: typeof v?.at === 'number' ? v.at : 0,
    version: typeof v?.version === 'string' && v.version.length > 0 ? v.version : null,
    lang: v?.lang === 'en' ? 'en' : v?.lang === 'ru' ? 'ru' : getLang(),
  };
}
function clearPending(): void {
  try { localStorage.removeItem(POLICY_PENDING_KEY); } catch { /* нечего стирать */ }
}

/* Отметка есть, но виденная редакция уже не текущая: спросить заново.
   Живёт в памяти; сама отметка остаётся на устройстве, пока человек не
   ответил, — закрыл приложение, не ответив, — спросим при следующем входе. */
let reask = false;
const reaskListeners = new Set<() => void>();
function setReask(v: boolean): void {
  if (reask === v) return;
  reask = v;
  for (const l of reaskListeners) {
    try { l(); } catch { /* подписчик не вправе уронить остальных */ }
  }
}

/** Нужно ли спросить согласие с политикой заново (отложенная отметка — на прежнюю редакцию). */
export function usePolicyReask(): boolean {
  return useSyncExternalStore(
    (l) => { reaskListeners.add(l); return () => { reaskListeners.delete(l); }; },
    () => reask,
    () => reask,
  );
}

/**
 * Человек ответил на повторный вопрос: согласие на текущую редакцию ушло
 * (`granted`) или он отказался. Прежняя отметка в обоих случаях не нужна:
 * согласием на новый текст она не станет никогда.
 */
export function resolvePolicyReask(): void {
  clearPending();
  setReask(false);
}

/**
 * Человек отметил согласие с политикой (онбординг) — на ту редакцию, которую
 * ему показали (`version`), на языке интерфейса. Отметка ложится на
 * устройство и уходит на сервер, как только есть вход.
 */
export function acceptPolicy(version: string | null, lang: Lang = getLang()): void {
  try {
    localStorage.setItem(POLICY_PENDING_KEY, JSON.stringify({ at: Date.now(), version, lang }));
  } catch { /* без хранилища — только эта попытка */ }
  void flushPolicyConsent();
}

export type PolicyFlush = 'sent' | 'already' | 'pending' | 'none' | 'failed' | 'reask';

let flushing: Promise<PolicyFlush> | null = null;

/**
 * Отправить отложенное согласие с политикой. Не бросает. Не отправилось по
 * сети — отметка остаётся и уйдёт при следующем входе. Текущую редакцию
 * называет сервер (`Me.legal.policy`); не назвал (текст не заведён) — ждём,
 * а не выдумываем. Виденная редакция ≠ текущей (или неизвестна) — не
 * отправляем, а спрашиваем заново ('reask'): согласие на один текст не
 * переносится молча на другой.
 */
export function flushPolicyConsent(): Promise<PolicyFlush> {
  if (flushing) return flushing;
  flushing = (async (): Promise<PolicyFlush> => {
    const pending = readPending();
    if (!pending) return 'none';
    if (sessionState().status !== 'user') return 'pending';
    const me = currentMe() ?? (await refreshMe());
    if (!me) return 'pending';
    if (hasConsent(me, 'policy')) {
      resolvePolicyReask();
      return 'already';
    }
    const current = legalVersion(me, 'policy');
    if (!current) return 'pending';
    if (pending.version !== current) {
      setReask(true);
      return 'reask';
    }
    try {
      await grantConsent('policy', current, pending.lang);
    } catch (e) {
      // 409 version_mismatch — редакция сменилась между чтением профиля и
      // отправкой: виденная уже не текущая, спрашиваем заново
      if (isVersionMismatch(e)) {
        void refreshMe();
        setReask(true);
        return 'reask';
      }
      return 'failed';
    }
    resolvePolicyReask();
    void refreshMe();
    return 'sent';
  })().finally(() => { flushing = null; });
  return flushing;
}

// Вошли — отправить то, что человек отметил до входа.
subscribeSession(() => {
  if (sessionState().status === 'user') void flushPolicyConsent();
});
