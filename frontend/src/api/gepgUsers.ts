import gepgClient from './gepgClient';
import type { GepgApiResponse, GepgPaginatedResponse, GepgUser } from '../types/gepg';

export const gepgUsersApi = {
  list: (page = 1, limit = 20) =>
    gepgClient.get<GepgPaginatedResponse<GepgUser>>('/users', { params: { page, limit } }),

  get: (id: number) => gepgClient.get<GepgApiResponse<GepgUser>>(`/users/${id}`),

  update: (id: number, data: Partial<Pick<GepgUser, 'email' | 'full_name' | 'role' | 'status'>>) =>
    gepgClient.put<GepgApiResponse<GepgUser>>(`/users/${id}`, {
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      status: data.status,
    }),

  delete: (id: number) => gepgClient.delete(`/users/${id}`),

  resetPassword: (id: number, newPassword: string) =>
    gepgClient.post(`/users/${id}/reset-password`, { newPassword }),
};
