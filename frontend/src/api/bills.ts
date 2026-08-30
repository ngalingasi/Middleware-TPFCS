import gepgClient from './gepgClient';
import type { Bill, CreateBillPayload, GepgApiResponse, GepgPaginatedResponse } from '../types/gepg';

export interface BillListParams {
  page?: number;
  limit?: number;
  status?: string;
  controlNumber?: string;
  startDate?: string;
  endDate?: string;
}

export const billsApi = {
  list: (params?: BillListParams) =>
    gepgClient.get<GepgPaginatedResponse<Bill>>('/bills', { params }),

  get: (billId: string) =>
    gepgClient.get<GepgApiResponse<Bill>>(`/bills/${billId}`),

  create: (data: CreateBillPayload) =>
    gepgClient.post<GepgApiResponse<{ success: boolean; billId: string }>>('/bills/create', data),

  createAndSubmit: (data: CreateBillPayload) =>
    gepgClient.post<GepgApiResponse<unknown>>('/bills/create-and-submit', data),

  submit: (billId: string) =>
    gepgClient.post<GepgApiResponse<unknown>>(`/bills/submit/${billId}`),

  cancel: (billId: string, reason: string) =>
    gepgClient.post<GepgApiResponse<unknown>>(`/bills/cancel/${billId}`, { reason }),
};
