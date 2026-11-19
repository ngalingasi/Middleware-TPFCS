// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Settings API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { CertificateStatus, GepgApiResponse, SettingChange, SettingGroup, SettingsData } from '../types/gepg';

export const gepgSettingsApi = {
  get: () => gepgClient.get<GepgApiResponse<SettingsData>>('/settings'),

  // a blank value clears the saved one, so the .env value is used again
  update: (values: Record<string, string>) =>
    gepgClient.put<GepgApiResponse<{ changes: SettingChange[]; groups: SettingGroup[] }>>('/settings', { values }),

  status: () => gepgClient.get<GepgApiResponse<{ certificates: CertificateStatus[] }>>('/settings/status'),

  uploadCertificate: (kind: CertificateStatus['kind'], file: { fileName: string; data: string; password?: string }) =>
    gepgClient.post<GepgApiResponse<{ certificates: CertificateStatus[] }>>(`/settings/certificates/${kind}`, file),

  generateCertificate: (options: { commonName: string; organization?: string; country?: string; years?: number }) =>
    gepgClient.post<GepgApiResponse<{ certificates: CertificateStatus[] }>>('/settings/certificates/signing/generate', options),

  signingPublicCertificate: () =>
    gepgClient.get<GepgApiResponse<{ name: string; pem: string; der: string }>>('/settings/certificates/signing/public'),

  removeCertificate: (kind: CertificateStatus['kind']) =>
    gepgClient.delete<GepgApiResponse<{ certificates: CertificateStatus[] }>>(`/settings/certificates/${kind}`),

  environment: () => gepgClient.get<GepgApiResponse<{ environment: string }>>('/settings/environment'),
};
