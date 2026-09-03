import gepgClient from './gepgClient';
import type { GepgApiResponse, GepgPaginatedResponse, GfsCodeRecord, GfsCodeStatus } from '../types/gepg';

export const gfsCodesApi = {
  listActive: () => gepgClient.get<GepgApiResponse<GfsCodeRecord[]>>('/gfs-codes'),

  listAdmin: (page = 1, limit = 20, status?: GfsCodeStatus) =>
    gepgClient.get<GepgPaginatedResponse<GfsCodeRecord>>('/gfs-codes/admin', {
      params: { page, limit, ...(status ? { status } : {}) },
    }),

  create: (code: string, description?: string) =>
    gepgClient.post<GepgApiResponse<GfsCodeRecord>>('/gfs-codes', { code, description }),

  update: (id: number, updates: { description?: string; status?: GfsCodeStatus }) =>
    gepgClient.patch<GepgApiResponse<unknown>>(`/gfs-codes/${id}`, updates),

  delete: (id: number) => gepgClient.delete<GepgApiResponse<unknown>>(`/gfs-codes/${id}`),
};
