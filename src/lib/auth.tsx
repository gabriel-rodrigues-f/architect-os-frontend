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

import { ApiError, authApi, setUnauthorizedHandler, type SessionUser } from "./api";

interface AuthContextValue {
  user: SessionUser | null;
  /** `true` enquanto a sessão (cookie HttpOnly) ainda está sendo validada. */
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

  // ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 24 — a sessão agora vive num
  // cookie HttpOnly, invisível para este JS: não há mais token nenhum para
  // checar antes de decidir chamar `/me`. Sempre chama; sem cookie válido o
  // backend devolve 401 e o catch abaixo só confirma "sem sessão".
  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        // 401 esperado sem sessão — nada para limpar no cliente.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12) — sessão
   * caindo NO MEIO do uso (cookie expirado/revogado) precisa levar de volta
   * ao login, não virar "não foi possível acessar o serviço" no meio da
   * tela. `setUser((current) => ...)` só limpa quando JÁ havia sessão —
   * assim o 401 esperado do `/me` inicial (sem sessão nenhuma ainda) e o
   * 401 de senha errada no próprio formulário de login não disparam este
   * aviso: os dois acontecem com `user` ainda `null`.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((current) => {
        if (!current) return current;
        queryClient.clear();
        toast.error("Sua sessão expirou. Faça login novamente.");
        return null;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      setUser(result.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await authApi.register(input);
      setUser(result.user);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    // Só o servidor apaga um cookie HttpOnly — mas o estado local precisa
    // limpar mesmo que a chamada de rede falhe (rede fora do ar, 401 por
    // sessão já expirada), senão a UI fica presa "logada" sem sessão real.
    try {
      await authApi.logout();
    } catch {
      // segue para limpar o estado local de qualquer forma.
    } finally {
      setUser(null);
      queryClient.clear();
    }
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
