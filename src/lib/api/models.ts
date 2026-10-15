// Провод программы «Модели ANZH» — лист ожидания и дни обучения.
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] Модели нужны только в дни обучения: процедуру делает
// обучающийся врач под контролем Анжелики. Цена для модели — прайс Анжелики по
// себестоимости (services.model_price_minor); действует ТОЛЬКО на запись
// моделью в день обучения (booking.kind = 'model'). Считает и применяет сервер.
//   GET  /models/program                 → {agreement, prices, days}
//   GET  /me/model                       → {model}
//   POST /me/model/apply                 → {model}
//   POST /models/days/{id}/book {slug}   → {booking, day}
//   Кабинет: GET /staff/models · PATCH /staff/models/{tid} · /staff/training-days · PUT /staff/model-agreement
import { apiRequest } from '../session';
import type { Booking } from './bookings';

export interface ModelAgreement { ru: string; en: string; version: string }
export interface ModelPrice { slug: string; title: { ru: string; en: string }; price_minor: number | null; model_price_minor: number; currency: string | null; duration_min: number | null }
export interface TrainingSlot { slug: string; spots: number; taken: number }
export interface TrainingDay { id: string; date: string; starts_at: string; ends_at: string; course_slug: string | null; slots: TrainingSlot[] }
export interface ModelProgram { agreement: ModelAgreement; prices: ModelPrice[]; days: TrainingDay[] }
export type ModelStatus = 'none' | 'pending' | 'approved' | 'declined';
export type Availability = 'weekdays' | 'weekends' | 'any';
export interface MyModel { status: ModelStatus; slugs: string[]; availability: Availability | null; reason: string | null; applied_at: string | null; bookings: Booking[] }

export async function getModelProgram(): Promise<ModelProgram> {
  return apiRequest<ModelProgram>('GET', '/models/program');
}
export async function getMyModel(): Promise<MyModel> {
  return (await apiRequest<{ model: MyModel }>('GET', '/me/model')).model;
}
export async function applyModel(body: { slugs: string[]; availability: Availability; agreement_version: string; photo_consent: true; adult: true }): Promise<MyModel> {
  return (await apiRequest<{ model: MyModel }>('POST', '/me/model/apply', { body })).model;
}
export async function bookModelDay(dayId: string, slug: string): Promise<{ booking: Booking; day: TrainingDay }> {
  return apiRequest('POST', `/models/days/${encodeURIComponent(dayId)}/book`, { body: { slug } });
}

/* ── Кабинет ── */
export interface StaffModel extends MyModel { telegram_id: number; name: string; times_model: number; health_flags: string[] }
export interface StaffTrainingDay extends TrainingDay { bookings: Array<{ id: string; name: string; slug: string; status: string; telegram_id: number }> }
export interface TrainingDayInput { date: string; from: string; to: string; course_slug: string | null; slots: Array<{ slug: string; spots: number }> }

export async function getStaffModels(status?: ModelStatus): Promise<StaffModel[]> {
  const r = await apiRequest<{ models: StaffModel[] }>('GET', '/staff/models', { query: { status } });
  return Array.isArray(r?.models) ? r.models : [];
}
export function decideModel(tid: number, status: 'approved' | 'declined' | 'none', reason?: string): Promise<unknown> {
  return apiRequest('PATCH', `/staff/models/${tid}`, { body: { status, reason } });
}
export async function getTrainingDays(): Promise<StaffTrainingDay[]> {
  const r = await apiRequest<{ days: StaffTrainingDay[] }>('GET', '/staff/training-days');
  return Array.isArray(r?.days) ? r.days : [];
}
export function saveTrainingDay(input: TrainingDayInput, id?: string): Promise<unknown> {
  return id
    ? apiRequest('PATCH', `/staff/training-days/${encodeURIComponent(id)}`, { body: input })
    : apiRequest('POST', '/staff/training-days', { body: input });
}
export function deleteTrainingDay(id: string): Promise<unknown> {
  return apiRequest('DELETE', `/staff/training-days/${encodeURIComponent(id)}`);
}
export function saveModelAgreement(ru: string, en: string): Promise<{ agreement: ModelAgreement }> {
  return apiRequest('PUT', '/staff/model-agreement', { body: { ru, en } });
}
