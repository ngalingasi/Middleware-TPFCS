import { createContext, useContext } from 'react';
import type { GepgUser } from '../types/gepg';

export interface GepgAuthState {
  user: GepgUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
}

export interface GepgAuthActions {
  login: (user: GepgUser, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<GepgUser>) => void;
}

export type GepgAuthContextType = GepgAuthState & GepgAuthActions;

export const GepgAuthContext = createContext<GepgAuthContextType | null>(null);

export const useGepgAuth = (): GepgAuthContextType => {
  const ctx = useContext(GepgAuthContext);
  if (!ctx) throw new Error('useGepgAuth must be used within GepgAuthProvider');
  return ctx;
};
