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
import { toast } from "sonner";

import { authApi, sessionPolicy, UserFacingError, type SessionUser } from "./api";
import { SESSION_QUERY_KEY, sessionQuery } from "./session-query";

interface AuthContextValue {
  user: SessionUser | null;

  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    queryClient
      .ensureQueryData(sessionQuery)
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [queryClient]);

  useEffect(() => {
    sessionPolicy.whenSessionEnded(() => {
      setUser((current) => {
        if (!current) return current;
        queryClient.clear();
        toast.error("Sua sessão expirou. Faça login novamente.");
        return null;
      });
    });
    return () => sessionPolicy.whenSessionEnded(null);
  }, [queryClient]);

  /**
   * `POST /auth/login` e `POST /auth/register` devolvem a conta autenticada,
   * não a SESSÃO: `memberships` só existe em `GET /auth/me` (backend
   * `auth.controller.ts`). Quem entra pela tela de login fica na mesma
   * instância da SPA — o `/auth/me` da montagem já falhou com 401 — então a
   * sessão precisa ser aberta relendo `/auth/me`, senão o vínculo de time
   * nunca chega à política de UI e o lead perde os destinos que rege.
   */
  const openSession = useCallback(
    async (authenticated: SessionUser) => {
      await queryClient.invalidateQueries();
      const session = await queryClient.fetchQuery(sessionQuery).catch(() => authenticated);
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
      setUser(session);
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      await openSession(result.user);
    },
    [openSession],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await authApi.register(input);
      await openSession(result.user);
    },
    [openSession],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
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

export function useCurrentUser(): SessionUser {
  const { user } = useAuth();
  if (!user) throw new Error("nenhuma sessão ativa");
  return user;
}

/**
 * Só `UserFacingError` tem mensagem escrita PARA a tela — `ApiError` inclusive,
 * que herda dele e cuja frase vem do serviço ou da `ApiFailureReading`. Um
 * `Error` qualquer (`TypeError`, `ZodError`, invariante de componente) carrega
 * texto de desenvolvedor, e a linha `if (error instanceof Error) return
 * error.message` entregava esse texto a quem só queria entrar no sistema.
 */
export const authErrorMessage = (error: unknown): string => {
  if (error instanceof UserFacingError) return error.message;
  return "Não foi possível concluir a operação. Tente de novo em alguns instantes.";
};
