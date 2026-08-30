import gepgClient from './gepgClient';
import type {
  GepgApiResponse,
  GepgLoginResponse,
  GepgUser,
  SendOtpData,
  ValidateCredentialsData,
} from '../types/gepg';

export const gepgAuthApi = {
  login: (username: string, password: string) =>
    gepgClient.post<GepgApiResponse<GepgLoginResponse>>('/auth/login', { username, password }),

  logout: () => gepgClient.post('/auth/logout'),

  getMe: () => gepgClient.get<GepgApiResponse<GepgUser>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    gepgClient.post('/auth/change-password', { currentPassword, newPassword }),

  // Admin only - create a new dashboard user
  register: (data: { username: string; email: string; password: string; fullName: string; role: string }) =>
    gepgClient.post<GepgApiResponse<GepgUser>>('/auth/register', data),

  // ── OTP login flow (3 steps) ────────────────────────────────────────────
  validateCredentials: (login: string, password: string) =>
    gepgClient.post<GepgApiResponse<ValidateCredentialsData> & { mustChangePassword?: boolean }>(
      '/auth/validate-credentials',
      { login, password }
    ),

  sendOtp: (login: string, channel: 'email' | 'sms') =>
    gepgClient.post<GepgApiResponse<SendOtpData>>('/auth/send-otp', { login, channel }),

  verifyOtp: (login: string, otp: string) =>
    gepgClient.post<GepgApiResponse<GepgLoginResponse>>('/auth/verify-otp', { login, otp }),
};
