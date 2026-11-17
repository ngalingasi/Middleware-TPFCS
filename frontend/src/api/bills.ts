// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Bills API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { Bill, CreateBillPayload, GepgApiResponse, GepgPaginatedResponse, PrintBillDocument } from '../types/gepg';

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

  // Data for the printable bill, or the TISS/SWIFT transfer bill
  printData: (billId: string, type: 'bill' | 'transfer' = 'bill') =>
    gepgClient.get<GepgApiResponse<PrintBillDocument>>(`/bills/${billId}/print`, { params: { type } }),

  // Extend an approved bill's expiry date; the control number is unchanged
  changeExpiry: (billId: string, billExpiryDate: string, reason: string) =>
    gepgClient.post<GepgApiResponse<unknown>>(`/bills/change/${billId}`, { billExpiryDate, reason }),

  // Reuse a control number GePG issued earlier for new bill details
  reuse: (data: CreateBillPayload & { paymentControlNumber: string; reuseReason: string }) =>
    gepgClient.post<GepgApiResponse<unknown>>('/bills/reuse', data),

  // Create and submit many bills at once; returns a result per bill
  bulk: (bills: CreateBillPayload[]) =>
    gepgClient.post<{
      success: boolean;
      message: string;
      summary: { total: number; succeeded: number; failed: number };
      results: Array<{ billId: string; success: boolean; code?: string; message: string }>;
    }>('/bills/bulk', { bills }),

  cancel: (billId: string, reason: string) =>
    gepgClient.post<GepgApiResponse<unknown>>(`/bills/cancel/${billId}`, { reason }),
};
