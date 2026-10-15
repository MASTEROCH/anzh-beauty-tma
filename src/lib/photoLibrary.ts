// Библиотека фотографий студии для кабинета: из чего владелица выбирает
// обложку процедуры, и как она загружает новую.
//
// Источник — те же снимки, что показывает витрина (data/works.ts,
// data/studio.ts), без отдельного списка: второй список разошёлся бы с
// первым при первой же замене файла.
//
// Фото уходит на сервер ТОЛЬКО относительным адресом `/photos/…`: тот же
// запрет, что у `photo_url` в каталоге (SAFE_PHOTO в data/services.ts).

import { PROCEDURE_PHOTOS, WORKS, WORK_GROUPS, thumbOf } from '../data/works';
import { STUDIO_PHOTOS } from '../data/studio';
import { uploadPhoto } from './api/studio';
import { newIdempotencyKey } from './session';

export interface LibPhoto {
  /** Полный снимок: этот адрес и уходит в `photo_url`. */
  src: string;
  /** Миниатюра для сетки. */
  thumb: string;
  label: string;
}

export interface LibGroup {
  id: string;
  title: string;
  photos: LibPhoto[];
}

const isSafe = (u: string) => /^\/photos\/(?:[A-Za-z0-9._-]+\/){0,2}[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/.test(u);

/**
 * Снимки для выбора. Сперва — этой процедуры (если известен её адрес),
 * затем остальные по процедурам, затем «Студия».
 */
export function photoLibrary(slug?: string): { mine: LibPhoto[]; groups: LibGroup[] } {
  const bySlug = new Map<string, LibPhoto[]>();
  for (const w of [...PROCEDURE_PHOTOS, ...WORKS]) {
    if (!w.published || !isSafe(w.src)) continue;
    const g = WORK_GROUPS[w.slug];
    const label = g?.short.ru ?? w.slug;
    (bySlug.get(w.slug) ?? bySlug.set(w.slug, []).get(w.slug)!).push({ src: w.src, thumb: thumbOf(w), label });
  }
  const mine = slug ? (bySlug.get(slug) ?? []) : [];
  const groups: LibGroup[] = [];
  for (const [id, photos] of bySlug) {
    if (id === slug) continue;
    groups.push({ id, title: WORK_GROUPS[id]?.short.ru ?? id, photos });
  }
  groups.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  groups.push({
    id: 'studio',
    title: 'Студия',
    photos: STUDIO_PHOTOS.filter((s) => isSafe(s.src)).map((s) => ({ src: s.src, thumb: s.thumb, label: s.caption.ru })),
  });
  return { mine, groups };
}

// ── Загрузка нового снимка ──────────────────────────────────────────────────

const MAX_SIDE = 1600;
const QUALITY = 0.82;

export class PhotoError extends Error {
  constructor(public code: 'not_image' | 'decode' | 'encode' | 'server' | 'network' | 'too_large' | 'bad_type', msg: string) {
    super(msg);
  }
}

/** Файл с телефона → WebP ≤ 1600 px по длинной стороне, base64 без префикса. */
export async function encodeForUpload(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new PhotoError('not_image', 'Это не изображение');
  let bmp: ImageBitmap;
  try {
    // imageOrientation: фото с телефона хранят поворот в метаданных — без этого
    // портрет встаёт боком
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('decode', 'Не удалось открыть снимок');
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('encode', 'Не удалось подготовить снимок');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', QUALITY));
  if (!blob) throw new PhotoError('encode', 'Не удалось сжать снимок');
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Загрузить файл и получить адрес `/photos/…` для `photo_url`. */
export async function uploadFile(file: File): Promise<string> {
  const data = await encodeForUpload(file);
  try {
    const r = await uploadPhoto(data, newIdempotencyKey());
    if (!isSafe(r.url)) throw new PhotoError('server', 'Сервер вернул неожиданный адрес снимка');
    return r.url;
  } catch (e) {
    if (e instanceof PhotoError) throw e;
    const code = (e as { code?: string; status?: number })?.code;
    const status = (e as { status?: number })?.status;
    if (status === 413 || code === 'too_large') throw new PhotoError('too_large', 'Снимок слишком большой');
    if (status === 415 || code === 'bad_type') throw new PhotoError('bad_type', 'Этот формат не принимается');
    if (status === 0) throw new PhotoError('network', 'Нет связи — снимок не загрузился');
    if (status === 404) throw new PhotoError('server', 'Загрузка фото на сервере ещё не включена');
    throw new PhotoError('server', 'Не загрузилось — повторите');
  }
}
