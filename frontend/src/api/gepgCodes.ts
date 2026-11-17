import gepgClient from './gepgClient';
import type { GepgApiResponse } from '../types/gepg';

export interface GepgCodeEntry {
  code: string;
  description: string;
}

export const gepgCodesApi = {
  list: () => gepgClient.get<GepgApiResponse<GepgCodeEntry[]>>('/gepg-codes'),
};
