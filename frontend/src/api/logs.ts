// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Logs API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { GepgApiResponse, GepgPaginatedResponse } from '../types/gepg';

export type MessageDirection = 'CLIENT_IN' | 'GEPG_OUT' | 'GEPG_IN';

export interface MessageLog {
  id: number;
  direction: MessageDirection;
  operation: string | null;
  billing_system_id: number | null;
  billing_system_code: string | null;
  bill_id: string | null;
  reference: string | null;
  method: string | null;
  url: string | null;
  ip_address: string | null;
  forwarded_for: string | null;
  user_agent: string | null;
  request_headers: string | null;
  request_body: string | null;
  status_code: number | null;
  response_body: string | null;
  ack_code: string | null;
  ok: 0 | 1;
  error: string | null;
  duration_ms: number | null;
  truncated: 0 | 1;
  created_at: string;
  request_size: number | null;
  response_size: number | null;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  full_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string | null;
  created_at: string;
  request_size: number | null;
  response_size: number | null;
  request_data?: string | null;
  response_data?: string | null;
}

export interface SignInEvent {
  id: number;
  created_at: string;
  event: string;
  ok: boolean;
  username: string | null;
  channel: string | null;
  ip_address: string | null;
  browser: string;
  reason: string | null;
}

export interface ActiveSession {
  id: number;
  username: string | null;
  full_name: string | null;
  role: string | null;
  ip_address: string | null;
  browser: string;
  created_at: string;
  expires_at: string;
  current: boolean;
}

export interface RetentionOverview {
  messages: { days: number; total: number; oldest: string | null };
  audit: { days: number; total: number; oldest: string | null };
}

export interface LogFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  ip?: string;
  startDate?: string;
  endDate?: string;
  direction?: MessageDirection;
  systemId?: string;
  ack?: string;
}

export const logsApi = {
  messages: (params: LogFilters) =>
    gepgClient.get<GepgPaginatedResponse<MessageLog> & { acks: string[] }>('/logs/messages', { params }),
  message: (id: number) => gepgClient.get<GepgApiResponse<MessageLog>>(`/logs/messages/${id}`),

  audit: (params: LogFilters) => gepgClient.get<GepgPaginatedResponse<AuditLog>>('/logs/activity', { params }),
  auditOne: (id: number) => gepgClient.get<GepgApiResponse<AuditLog>>(`/logs/activity/${id}`),

  signIns: (params: LogFilters) => gepgClient.get<GepgPaginatedResponse<SignInEvent>>('/logs/logins', { params }),

  sessions: () => gepgClient.get<GepgApiResponse<ActiveSession[]>>('/logs/sessions'),
  endSession: (id: number) => gepgClient.delete<GepgApiResponse<unknown>>(`/logs/sessions/${id}`),

  retention: () => gepgClient.get<GepgApiResponse<RetentionOverview>>('/logs/retention'),
  runRetention: () =>
    gepgClient.post<GepgApiResponse<{ removed: { messages: number; audit: number }; overview: RetentionOverview }> & { message: string }>('/logs/retention/run'),
};
