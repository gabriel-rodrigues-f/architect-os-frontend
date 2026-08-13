import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError, authApi, loadStoredToken, setAuthToken, type SessionUser } from "./api";

interface AuthContextValue {
  user: SessionUser | null;
  /** `true` enquanto a sessão guardada no navegador ainda está sendo validada. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Na carga, tenta reaproveitar o token do navegador; se estiver expirado ou
  // a conta não existir mais, a sessão é descartada.
  useEffect(() => {
    const token = loadStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    authApi
      .me()
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        setAuthToken(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      setAuthToken(result.token);
      setUser(result.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await authApi.register(input);
      setAuthToken(result.token);
      setUser(result.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

/** Usuário logado — use em telas que já rodam atrás do login. */
export function useCurrentUser(): SessionUser {
  const { user } = useAuth();
  if (!user) throw new Error("nenhuma sessão ativa");
  return user;
}

export const authErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Não foi possível concluir a operação";
};
