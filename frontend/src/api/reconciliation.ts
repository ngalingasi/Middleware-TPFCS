import gepgClient from './gepgClient';
import type {
  GepgApiResponse,
  GepgPaginatedResponse,
  ReconciliationRequest,
  ReconciliationRequestDetail,
} from '../types/gepg';

export interface ReconciliationListParams {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const reconciliationApi = {
  list: (params?: ReconciliationListParams) =>
    gepgClient.get<GepgPaginatedResponse<ReconciliationRequest>>('/reconciliation', { params }),

  get: (requestId: string) =>
    gepgClient.get<GepgApiResponse<ReconciliationRequestDetail>>(`/reconciliation/${requestId}`),

  submitRequest: (transactionDate: string, reconciliationOption: 1 | 2 = 1) =>
    gepgClient.post<GepgApiResponse<unknown>>('/reconciliation/request', {
      transactionDate,
      reconciliationOption,
    }),
};
