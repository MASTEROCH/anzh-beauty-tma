// Единая форма ошибки (контракт §7.1):
//   { "error": { "code": "slot_taken", "message": "Время уже занято" } }
//
// В ответе — код и короткое сообщение. Ни трассировки стека, ни текста
// запроса к базе (контракт §12): по ним читается устройство сервера, а
// в тексте запроса могут оказаться данные из анкеты.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  toBody(): { error: { code: string; message: string } } {
    return { error: { code: this.code, message: this.message } };
  }
}

/** 401 — сессии нет или она негодна. */
export const unauthorized = (code = 'no_session', message = 'Нужно войти заново') =>
  new ApiError(401, code, message);

/** 403 — вошёл, но прав на ЭТОТ объект нет. */
export const forbidden = (code = 'forbidden', message = 'Недостаточно прав') =>
  new ApiError(403, code, message);

/** 404 — объекта нет либо он не ваш (наружу это одно и то же). */
export const notFound = (code = 'not_found', message = 'Не найдено') =>
  new ApiError(404, code, message);

/** 409 — конфликт состояния: слот занят, повторная привязка. */
export const conflict = (code: string, message: string) => new ApiError(409, code, message);

/** 422 — тело запроса не проходит проверку. */
export const invalid = (message: string, code = 'invalid') => new ApiError(422, code, message);

/** 429 — слишком часто. */
export const tooMany = (message = 'Слишком часто, попробуйте через минуту') =>
  new ApiError(429, 'rate_limited', message);
