// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG codes API
// └──────────────────────────────────────────────────────────────────────────┘

import gepgClient from './gepgClient';
import type { GepgApiResponse } from '../types/gepg';

export interface GepgCodeEntry {
  code: string;
  description: string;
}

export const gepgCodesApi = {
  list: () => gepgClient.get<GepgApiResponse<GepgCodeEntry[]>>('/gepg-codes'),
};
