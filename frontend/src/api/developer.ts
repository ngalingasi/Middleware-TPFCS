// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Developer docs API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { DeveloperData, GepgApiResponse } from '../types/gepg';

export const developerApi = {
  docs: (systemId?: string) =>
    gepgClient.get<GepgApiResponse<DeveloperData>>('/developer/docs', { params: systemId ? { systemId } : undefined }),

  // the login token goes in a header, so a plain link cannot download: fetch the file and save it
  download: async (fileId: string, fileName: string, systemId?: string) => {
    const res = await gepgClient.get<Blob>(`/developer/files/${fileId}`, {
      params: systemId ? { systemId } : undefined,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
};
