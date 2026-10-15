// Провод оплаты звёздами (server/openapi.yaml, раздел «Оплата»).
// Правила папки — как в `api/me.ts`: типы провода и тонкие вызовы.

import { apiRequest } from '../session';

/** POST /payments/invoice → 201 `{invoice_id, invoice_link}`. */
export interface InvoiceResponse {
  invoice_id: string;
  /** Для `Telegram.WebApp.openInvoice` */
  invoice_link: string;
}

export type ProductKind = 'analysis' | 'analysis_bundle' | 'training';

/** Элемент GET /me/purchases (openapi `Purchase`). */
export interface ServerPurchase {
  product_slug: string;
  product_kind: ProductKind;
  /** `refunded` — доступа НЕТ */
  status: 'paid' | 'refunded';
  paid_at?: string | null;
  /**
   * Какие разборы открывает покупка — снимок состава на момент оплаты
   * (решение John перед волной 3, Х1): у разбора `[slug]`, у набора — slug
   * из `purchases.metadata`. Разбор, добавленный в набор позже, сюда не
   * попадает. Необязательное: сервер до Х1 поля не присылал.
   */
  covers?: string[];
}

/**
 * Счёт в Telegram Stars. Цена — из базы сервера, не из запроса. Ключ
 * идемпотентности создаёт ВЫЗЫВАЮЩИЙ, один на намерение человека (одно
 * нажатие «Оплатить»): сетевой повтор с тем же ключом вернёт тот же счёт.
 *
 * `termsVersion` — редакция Условий покупки, которую человек принял галочкой
 * на экране: ровно `Me.legal.terms`, байт в байт. Сервер сравнивает строки
 * без trim и без разбора на числа (payments.js assertTermsAccepted), поэтому
 * здесь её не трогают. `null` — сервер версию не назвал: ключа в теле НЕТ
 * (не `""`), сервер ответит 409 `terms_not_accepted` — решает он, не экран.
 *
 * Отказы (ApiError.code): 403 feature_disabled · 409 terms_not_accepted /
 * already_purchased / idempotency_in_progress · 422 unknown_product /
 * stars_not_allowed_for_kind · 429 rate_limited · 503 unavailable / not_configured.
 */
export function createInvoice(
  productSlug: string,
  idempotencyKey: string,
  termsVersion: string | null,
): Promise<InvoiceResponse> {
  const body: { product_slug: string; terms_version?: string } = { product_slug: productSlug };
  if (typeof termsVersion === 'string' && termsVersion !== '') body.terms_version = termsVersion;
  return apiRequest<InvoiceResponse>('POST', '/payments/invoice', { body, idempotencyKey });
}

/**
 * GET /me/purchases — ЕДИНСТВЕННЫЙ источник доступа к платному. Флагом не
 * закрыт: купленное видно, даже когда новые покупки выключены.
 */
export async function getPurchases(signal?: AbortSignal): Promise<ServerPurchase[]> {
  const r = await apiRequest<{ purchases: ServerPurchase[] }>('GET', '/me/purchases', { signal });
  return Array.isArray(r?.purchases) ? r.purchases : [];
}
