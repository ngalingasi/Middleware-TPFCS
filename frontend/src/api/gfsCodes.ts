// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GFS codes API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { GepgApiResponse, GepgPaginatedResponse, GfsCodeRecord, GfsCodeStatus } from '../types/gepg';

export const gfsCodesApi = {
  listActive: () => gepgClient.get<GepgApiResponse<GfsCodeRecord[]>>('/gfs-codes'),

  listAdmin: (page = 1, limit = 20, status?: GfsCodeStatus) =>
    gepgClient.get<GepgPaginatedResponse<GfsCodeRecord>>('/gfs-codes/admin', {
      params: { page, limit, ...(status ? { status } : {}) },
    }),

  create: (code: string, description?: string, billingSystemId?: number | null) =>
    gepgClient.post<GepgApiResponse<GfsCodeRecord>>('/gfs-codes', { code, description, billingSystemId }),

  // billingSystemId: a number links the code to that billing system, null unlinks it
  update: (id: number, updates: { description?: string; status?: GfsCodeStatus; billingSystemId?: number | null }) =>
    gepgClient.patch<GepgApiResponse<unknown>>(`/gfs-codes/${id}`, updates),

  delete: (id: number) => gepgClient.delete<GepgApiResponse<unknown>>(`/gfs-codes/${id}`),
};
