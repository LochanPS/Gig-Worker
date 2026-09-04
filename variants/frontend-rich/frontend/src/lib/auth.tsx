import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role, User } from '@gigbridge/shared';
import { api, setToken, getToken } from './api';
import { socket } from './ws';

interface AuthValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setReady(true);
      return;
    }
    api
      .get<User>('/auth/me')
      .then((u) => {
        setUser(u);
        socket.connect(t);
      })
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const adopt = useCallback((res: { token: string; user: User }) => {
    setToken(res.token);
    setUser(res.user);
    socket.connect(res.token);
    return res.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      adopt(await api.post<{ token: string; user: User }>('/auth/login', { email, password })),
    [adopt],
  );

  const register = useCallback(
    async (payload: Record<string, unknown>) =>
      adopt(await api.post<{ token: string; user: User }>('/auth/register', payload)),
    [adopt],
  );

  const logout = useCallback(() => {
    socket.close();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

export const homeFor = (role: Role): string =>
  role === 'COMPANY' ? '/company' : role === 'FREELANCER' ? '/me' : '/admin';

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
