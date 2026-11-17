// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ API keys API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { ApiKeyRecord, ApiKeyStatus, CreatedApiKey, GepgApiResponse } from '../types/gepg';

export const apiKeysApi = {
  list: () => gepgClient.get<GepgApiResponse<ApiKeyRecord[]>>('/api-keys'),

  create: (name: string, billingSystemId: number) =>
    gepgClient.post<GepgApiResponse<CreatedApiKey>>('/api-keys', { name, billingSystemId }),

  assignSystem: (id: number, billingSystemId: number) =>
    gepgClient.patch<GepgApiResponse<unknown>>(`/api-keys/${id}/system`, { billingSystemId }),

  setStatus: (id: number, status: ApiKeyStatus) =>
    gepgClient.patch<GepgApiResponse<unknown>>(`/api-keys/${id}/status`, { status }),

  delete: (id: number) => gepgClient.delete<GepgApiResponse<unknown>>(`/api-keys/${id}`),
};
