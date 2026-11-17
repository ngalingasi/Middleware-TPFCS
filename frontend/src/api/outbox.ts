// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Outbox API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { EventStatus, GepgApiResponse, GepgPaginatedResponse, OutboxEvent, OutboxEventDetail, OutboxStats } from '../types/gepg';

export interface OutboxParams {
  page?: number;
  limit?: number;
  systemId?: string;
  status?: EventStatus | '';
  type?: string;
  billId?: string;
}

export const outboxApi = {
  list: (params?: OutboxParams) =>
    gepgClient.get<GepgPaginatedResponse<OutboxEvent> & { stats: OutboxStats; types: string[] }>('/outbox', { params }),

  get: (id: number) => gepgClient.get<GepgApiResponse<OutboxEventDetail>>(`/outbox/${id}`),

  replay: (id: number) => gepgClient.post<GepgApiResponse<unknown>>(`/outbox/${id}/replay`),
};
