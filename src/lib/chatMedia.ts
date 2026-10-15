// Вложения чата: подготовка файла на устройстве до отправки.
//
// Фото: перекодируем в JPEG ≤ 2048 px по длинной стороне, качество 0.85.
// С телефона приходит 4–12 МБ HEIC/JPEG; в сеть уходит 300–900 КБ, а
// снимка хватает, чтобы врач разглядел кожу. JPEG, а не WebP: его без
// оговорок открывают и Telegram, и почта, и старый Safari, куда админ может
// переслать снимок. Поворот из EXIF применяется (imageOrientation).
// Видео: не перекодируется (в браузере это дорого и долго) — проверяем тип,
// размер (≤ 60 МБ) и длительность (≤ 3 мин), чтобы отказ был сразу и
// понятный, а не после минуты загрузки.

export type MediaKind = 'image' | 'video';

export class MediaError extends Error {
  constructor(public code: 'type' | 'too_large' | 'too_long' | 'decode', message: string) { super(message); }
}

const MAX_SIDE = 2048;
const VIDEO_MB = 60;
const VIDEO_SEC = 180;
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export interface PreparedMedia {
  kind: MediaKind;
  blob: Blob;
  /** Локальный адрес для мгновенного показа, пока файл едет на сервер. */
  preview: string;
  width?: number;
  height?: number;
}

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (file.type.startsWith('image/')) return prepareImage(file);
  if (VIDEO_TYPES.includes(file.type) || /\.(mp4|mov|webm)$/i.test(file.name)) return prepareVideo(file);
  throw new MediaError('type', 'Можно отправить фото или видео');
}

async function prepareImage(file: File): Promise<PreparedMedia> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new MediaError('decode', 'Не удалось открыть снимок');
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * k);
  const height = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MediaError('decode', 'Не удалось подготовить снимок');
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) throw new MediaError('decode', 'Не удалось сжать снимок');
  return { kind: 'image', blob, preview: URL.createObjectURL(blob), width, height };
}

async function prepareVideo(file: File): Promise<PreparedMedia> {
  if (file.size > VIDEO_MB * 1024 * 1024) throw new MediaError('too_large', `Видео больше ${VIDEO_MB} МБ — обрежьте его или отправьте в Telegram`);
  const preview = URL.createObjectURL(file);
  const seconds = await new Promise<number>((ok) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => ok(v.duration);
    v.onerror = () => ok(0);
    v.src = preview;
  });
  if (seconds > VIDEO_SEC) {
    URL.revokeObjectURL(preview);
    throw new MediaError('too_long', 'Видео длиннее 3 минут — обрежьте его или отправьте в Telegram');
  }
  const type = file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : /\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4');
  return { kind: 'video', blob: file.type ? file : new Blob([file], { type }), preview };
}

export const MEDIA_ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm';
