// Auth context: login, current user, token persistence.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Role } from '@gigbridge/shared';
import { api, setToken, getToken } from './api.js';

export interface RegisterInput {
  email: string; password: string; role: Role; country: string; name: string;
  legalName?: string; regNumber?: string; panOrTaxId?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
    return user;
  };
  const register = async (input: RegisterInput) => {
    const { token, user } = await api.register(input);
    setToken(token);
    setUser(user);
    return user;
  };
  const logout = () => { setToken(null); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
