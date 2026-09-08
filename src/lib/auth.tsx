import { defaultSidebarPreferences } from "@/lib/sidebar-preferences";
import { DashboardEntrance } from "@/lib/dashboard-entrance";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { authApi, sessionPolicy, supportAccess, UserFacingError, type SessionUser } from "./api";
import { SessionBootstrap, SessionBootstrapReader } from "./session-bootstrap";
import { SessionEndReason, sessionEndMemory } from "./session-end-reason";
import { SESSION_QUERY_KEY, sessionQuery } from "./session-query";

interface AuthContextValue {
  user: SessionUser | null;

  loading: boolean;
  /** O que a aplicação sabe da sessão: lendo, aberta, ausente ou serviço fora. */
  bootstrap: SessionBootstrap;
  /** A pessoa pediu para tentar de novo enquanto o serviço está fora. */
  retrySession: () => void;
  /**
   * `onAccepted` roda assim que o serviço ACEITA a credencial, antes de a
   * sessão abrir — é o instante do pulso azul do login. Ele pode DEMORAR de
   * propósito: a tela espera a onda azul cruzar a rede antes de a aplicação
   * abrir (dono, 2026-09-08), e por isso a sessão só continua depois dele.
   */
  login: (
    email: string,
    password: string,
    onAccepted?: () => Promise<void> | void,
  ) => Promise<void>;
  register: (
    input: { name: string; email: string; password: string },
    onAccepted?: () => Promise<void> | void,
  ) => Promise<void>;
  /** Revoga no serviço e fecha a sessão desta aba; a razão chega ao login (PR 9). */
  logout: (reason?: SessionEndReason) => Promise<void>;
  /**
   * Fecha a sessão desta aba SEM chamar o serviço — para quando o cookie já
   * morreu do outro lado (senha nova, 401). É o único lugar que zera o cache.
   */
  closeSession: (reason: SessionEndReason) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  /**
   * A SESSÃO É UM ESTADO EXPLÍCITO, não `user` nulo + `loading` (dono,
   * 2026-09-07: "derrubei o backend… quando atualizei a tela fui deslogado.
   * isso não pode ocorrer, somente se o token do frontend expirar"). Com dois
   * booleanos, toda falha da leitura virava "ninguém logado" e o portão
   * desenhava o login por cima de uma sessão que ainda vale. Só o 401 diz
   * isso; o resto é o serviço fora, e o leitor insiste até ele responder.
   */
  const [bootstrap, setBootstrap] = useState<SessionBootstrap>(SessionBootstrap.reading);
  const [reader, setReader] = useState<SessionBootstrapReader | null>(null);
  const user = bootstrap.user;
  const setUser = useCallback(
    (next: SessionUser | null | ((current: SessionUser | null) => SessionUser | null)) => {
      setBootstrap((current) => {
        const nextUser = typeof next === "function" ? next(current.user) : next;
        // A mesma conta é o mesmo estado — `serviceDown` e `reading` não viram `absent` por tabela.
        return nextUser === current.user ? current : SessionBootstrap.of(nextUser);
      });
    },
    [],
  );

  useEffect(() => {
    const sessionReader = new SessionBootstrapReader(
      () => queryClient.ensureQueryData(sessionQuery),
      setBootstrap,
    );
    setReader(sessionReader);
    sessionReader.start();
    return () => sessionReader.stop();
  }, [queryClient]);

  const retrySession = useCallback(() => reader?.retryNow(), [reader]);

  /**
   * O ÚNICO ENCERRAMENTO DA SESSÃO DESTA ABA (PR 9, [FA-02]/[FA-06]): "Sair",
   * inatividade, 401 e senha nova passam todos por aqui. A razão vai para o
   * estado (o `AuthGate` a entrega ao login) e para a memória da aba (o F5
   * ainda encontra a frase). Cache, passe de suporte e sessão morrem juntos.
   */
  const closeSession = useCallback(
    (reason: SessionEndReason) => {
      sessionEndMemory.remember(reason);
      queryClient.clear();
      // [FA-07]: o passe de suporte é desta sessão — morre com ela.
      supportAccess.clear();
      setBootstrap(SessionBootstrap.absent(reason));
    },
    [queryClient],
  );

  /**
   * O 401 de sessão chega pela política, fora do React. Antes ele fechava a
   * sessão DENTRO de um updater de `setState` — impuro, e o StrictMode o
   * reexecuta. A guarda "só se há sessão" agora lê a sessão corrente por
   * referência: o 401 do `/auth/me` da montagem continua sem efeito.
   */
  const currentUser = useRef<SessionUser | null>(null);
  useEffect(() => {
    currentUser.current = user;
  }, [user]);

  useEffect(() => {
    sessionPolicy.whenSessionEnded(() => {
      if (currentUser.current === null) return;
      currentUser.current = null;
      closeSession(SessionEndReason.expired);
    });
    return () => sessionPolicy.whenSessionEnded(null);
  }, [closeSession]);

  // Sessão aberta — por login ou pela leitura da montagem — esquece a razão da anterior.
  useEffect(() => {
    if (user !== null) sessionEndMemory.clear();
  }, [user]);

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
  }, [setUser]);

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
    [queryClient, setUser],
  );

  const login = useCallback(
    async (email: string, password: string, onAccepted?: () => Promise<void> | void) => {
      const result = await authApi.login(email, password);
      await onAccepted?.();
      defaultSidebarPreferences.forgetCollapsedGroups();
      // A primeira abertura do Painel depois do login ganha a entrada orquestrada.
      DashboardEntrance.arm(result.user);
      await openSession(result.user);
    },
    [openSession],
  );

  const register = useCallback(
    async (
      input: { name: string; email: string; password: string },
      onAccepted?: () => Promise<void> | void,
    ) => {
      const result = await authApi.register(input);
      await onAccepted?.();
      defaultSidebarPreferences.forgetCollapsedGroups();
      DashboardEntrance.arm(result.user);
      await openSession(result.user);
    },
    [openSession],
  );

  const logout = useCallback(
    async (reason: SessionEndReason = SessionEndReason.manual) => {
      await authApi.logout().catch(() => undefined);
      closeSession(reason);
    },
    [closeSession],
  );

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
      // Dono (2026-09-06): senha nova, sessão nova — a pessoa volta pela tela
      // de login, nunca entra direto. O backend já fechou o cookie; é ato da
      // pessoa, então o login não explica nada.
      closeSession(SessionEndReason.manual);
    },
    [closeSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: bootstrap.loading,
      bootstrap,
      retrySession,
      login,
      register,
      logout,
      closeSession,
      changePassword,
    }),
    [user, bootstrap, retrySession, login, register, logout, closeSession, changePassword],
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
