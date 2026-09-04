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
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
   * A rede de segurança do primeiro acesso. O caminho normal é a marca chegar
   * em `/auth/me` e o `AuthGate` desenhar a troca antes de qualquer navegação.
   * Se ainda assim alguma rota recusar por senha pendente, levantar a marca
   * aqui leva a pessoa para a troca — o único lugar onde ela pode resolver o
   * que a recusa está pedindo — em vez de desenhar um erro de permissão.
   *
   * Devolver a MESMA conta quando a marca já está de pé é o que impede o
   * ciclo: sem isso, cada recusa criaria um objeto novo e um render novo.
   */
  useEffect(() => {
    sessionPolicy.whenPasswordChangeRequired(() => {
      setUser((current) =>
        current === null || current.mustChangePassword
          ? current
          : { ...current, mustChangePassword: true },
      );
    });
    return () => sessionPolicy.whenPasswordChangeRequired(null);
  }, []);

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

  /**
   * A troca do PRIMEIRO ACESSO. O serviço responde 204 e derruba a marca;
   * quem reabre a aplicação aqui é a releitura de `/auth/me` — e é ela que
   * cumpre a parte do pedido que diz "depois de trocar, a pessoa segue para
   * onde iria, sem precisar entrar de novo".
   *
   * `/auth/me` é uma das três rotas liberadas enquanto a marca está de pé,
   * então a releitura funciona no exato momento em que qualquer outra ainda
   * seria recusada. Se mesmo assim ela não vier, `openSession` cai na conta
   * que passamos com a marca já derrubada: a troca ACONTECEU (204), e
   * segurar a pessoa na tela por causa de uma leitura que falhou seria punir
   * quem já fez a parte dela.
   */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await authApi.changePassword(currentPassword, newPassword);
      if (user !== null) await openSession({ ...user, mustChangePassword: false });
    },
    [openSession, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, changePassword }),
    [user, loading, login, register, logout, changePassword],
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
