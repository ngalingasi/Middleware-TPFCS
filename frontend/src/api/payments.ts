import gepgClient from './gepgClient';
import type { GepgApiResponse, GepgPaginatedResponse, Payment, PaymentStatistics } from '../types/gepg';

export interface PaymentListParams {
  page?: number;
  limit?: number;
  status?: string;
  paymentType?: string;
  billId?: string;
  startDate?: string;
  endDate?: string;
}

export const paymentsApi = {
  list: (params?: PaymentListParams) =>
    gepgClient.get<GepgPaginatedResponse<Payment>>('/payments', { params }),

  get: (paymentId: number | string) =>
    gepgClient.get<GepgApiResponse<Payment>>(`/payments/${paymentId}`),

  statistics: (startDate?: string, endDate?: string) =>
    gepgClient.get<GepgApiResponse<PaymentStatistics>>('/payments/statistics/summary', {
      params: { startDate, endDate },
    }),
};
