import { authApi, type SessionUser } from "./api";

export const SESSION_QUERY_KEY = ["auth-me"] as const;

export const sessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: (): Promise<SessionUser> => authApi.me(),
  staleTime: 30_000,
  retry: false,
} as const;

export const INSTANCE_STATUS_QUERY_KEY = ["service-heartbeat"] as const;

/**
 * [FA-11] — a MESMA leitura de `/auth/status` para o login (há contas?) e
 * para a tela de queda (o serviço voltou?). A tela de queda acrescenta o
 * pulso (`refetchInterval`); o login lê uma vez e não refaz ao focar a janela —
 * a resposta só muda quando a primeira conta nasce, e isso é ato desta tela.
 */
export const instanceStatusQuery = {
  queryKey: INSTANCE_STATUS_QUERY_KEY,
  queryFn: (): Promise<{ hasUsers: boolean }> => authApi.status(),
  retry: false,
} as const;
