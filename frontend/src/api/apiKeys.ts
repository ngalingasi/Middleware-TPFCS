import gepgClient from './gepgClient';
import type { ApiKeyRecord, ApiKeyStatus, CreatedApiKey, GepgApiResponse } from '../types/gepg';

export const apiKeysApi = {
  list: () => gepgClient.get<GepgApiResponse<ApiKeyRecord[]>>('/api-keys'),

  create: (name: string) =>
    gepgClient.post<GepgApiResponse<CreatedApiKey>>('/api-keys', { name }),

  setStatus: (id: number, status: ApiKeyStatus) =>
    gepgClient.patch<GepgApiResponse<unknown>>(`/api-keys/${id}/status`, { status }),

  delete: (id: number) => gepgClient.delete<GepgApiResponse<unknown>>(`/api-keys/${id}`),
};
