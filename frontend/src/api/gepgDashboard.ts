import gepgClient from './gepgClient';
import type { DashboardData, GepgApiResponse } from '../types/gepg';

export const gepgDashboardApi = {
  statistics: () => gepgClient.get<GepgApiResponse<DashboardData>>('/dashboard/statistics'),
  recentActivities: (limit = 20) =>
    gepgClient.get<GepgApiResponse<unknown[]>>('/dashboard/recent-activities', { params: { limit } }),
  paymentChannels: () => gepgClient.get<GepgApiResponse<unknown[]>>('/dashboard/payment-channels'),
  dailySummary: () => gepgClient.get<GepgApiResponse<unknown[]>>('/dashboard/daily-summary'),
  topPayers: (limit = 10) =>
    gepgClient.get<GepgApiResponse<unknown[]>>('/dashboard/top-payers', { params: { limit } }),
};
