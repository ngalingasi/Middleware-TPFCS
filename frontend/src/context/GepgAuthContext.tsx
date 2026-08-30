import { useState, useEffect, type ReactNode } from 'react';
import { GepgAuthContext } from '../store/gepgAuthStore';
import { TOKEN_KEY, USER_KEY } from '../api/gepgClient';
import { gepgAuthApi } from '../api/gepgAuth';
import type { GepgUser } from '../types/gepg';

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const GepgAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<GepgUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const stored = localStorage.getItem(USER_KEY);

      if (!token || isTokenExpired(token)) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setIsLoading(false);
        return;
      }

      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          localStorage.removeItem(USER_KEY);
        }
      }

      // Confirm the session is still valid server-side (session could have
      // been revoked even if the JWT itself hasn't expired yet).
      try {
        const { data } = await gepgAuthApi.getMe();
        setUser(data.data);
        localStorage.setItem(USER_KEY, JSON.stringify(data.data));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = (u: GepgUser, token: string) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  };

  const logout = () => {
    gepgAuthApi.logout().catch(() => {});
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const updateUser = (partial: Partial<GepgUser>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <GepgAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAdmin: user?.role === 'ADMIN',
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </GepgAuthContext.Provider>
  );
};
