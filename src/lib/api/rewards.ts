// Провод «скидки за действия» — разовые, −5% за каждое, на следующую процедуру.
// 🔴 [ПРЕДЛОЖЕНИЕ БЭКЕНДУ] Считает и применяет сервер (POST /services/quote → discount_percent).
//   GET  /me/rewards                    → {rewards}
//   POST /me/rewards/story {proof}      → {rewards}  (сторис проверяет администратор)
//   GET  /staff/rewards/pending         → {pending: [{client_id, name, action, proof, sent_at}]}
//   POST /staff/rewards/{client_id}/approve | /reject
// profile, invite, review засчитывает сервер сам (результат Skin Profile, подруга по ссылке, отзыв).
import { apiRequest } from '../session';

export type RewardAction = 'profile' | 'invite' | 'story' | 'review';
export type RewardState = 'idle' | 'pending' | 'done';

export interface RewardsWire {
  actions: Record<RewardAction, RewardState>;
  per_action: number;
  /** Действующая скидка на следующую процедуру, % */
  percent: number;
  max_percent: number;
  /** Скидка уже использована на визите */
  used: boolean;
}

export interface PendingReward { client_id: number; name: string; action: RewardAction; proof?: string | null; sent_at?: string }

export async function getMyRewards(signal?: AbortSignal): Promise<RewardsWire> {
  const r = await apiRequest<{ rewards: RewardsWire }>('GET', '/me/rewards', { signal });
  return r.rewards;
}
export async function submitStory(proof: string): Promise<RewardsWire> {
  const r = await apiRequest<{ rewards: RewardsWire }>('POST', '/me/rewards/story', { body: { proof } });
  return r.rewards;
}
export async function getPendingRewards(): Promise<PendingReward[]> {
  const r = await apiRequest<{ pending: PendingReward[] }>('GET', '/staff/rewards/pending');
  return Array.isArray(r?.pending) ? r.pending : [];
}
export function decideReward(clientId: number, verdict: 'approve' | 'reject'): Promise<unknown> {
  return apiRequest('POST', `/staff/rewards/${clientId}/${verdict}`);
}
