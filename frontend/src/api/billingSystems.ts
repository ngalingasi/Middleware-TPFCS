// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Billing systems API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { ApiKeyRecord, BillingSystem, BillingSystemInput, BillingSystemList, GepgApiResponse, SystemTestResult } from '../types/gepg';

// the signing secret comes back once, when a system is created or its secret is rotated
export const billingSystemsApi = {
  list: () => gepgClient.get<GepgApiResponse<BillingSystemList>>('/billing-systems'),

  create: (data: BillingSystemInput) =>
    gepgClient.post<GepgApiResponse<{ system: BillingSystem; secret: string }>>('/billing-systems', data),

  update: (id: number, data: BillingSystemInput) =>
    gepgClient.put<GepgApiResponse<BillingSystem>>(`/billing-systems/${id}`, data),

  rotateSecret: (id: number) => gepgClient.post<GepgApiResponse<{ secret: string }>>(`/billing-systems/${id}/secret`),

  keys: (id: number) => gepgClient.get<GepgApiResponse<ApiKeyRecord[]>>(`/billing-systems/${id}/keys`),

  test: (id: number) => gepgClient.post<GepgApiResponse<SystemTestResult>>(`/billing-systems/${id}/test`),

  replayDead: (id: number) => gepgClient.post<GepgApiResponse<{ count: number }>>(`/billing-systems/${id}/replay-dead`),
};
