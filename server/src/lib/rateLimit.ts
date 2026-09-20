// Ограничение частоты на входе, оплате и ассистенте (контракт §12).
//
// В памяти процесса, без Redis — так и просили (§2.1: «Кэш, Redis →
// ничего»). Следствие названо честно: при нескольких экземплярах сервера
// счётчик у каждого свой. Для одного салона в Батуми этого достаточно;
// когда экземпляров станет больше одного, счётчик переедет в базу — это
// замена одной функции, а не переделка.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Мусор копится: ключ живёт, пока о нём помнят. Раз в минуту выносим
// протухшее, иначе процесс растёт памятью на каждом новом посетителе.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, 60_000);
// Таймер не держит процесс: без unref сервер не завершится по Ctrl+C.
sweeper.unref();

export interface RateVerdict {
  allowed: boolean;
  /** Через сколько секунд можно снова. */
  retryAfterSec: number;
}

export function hit(key: string, limit: number, windowSec: number): RateVerdict {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, retryAfterSec: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Только для тестов: сбросить состояние между прогонами. */
export function resetRateLimits(): void {
  buckets.clear();
}
