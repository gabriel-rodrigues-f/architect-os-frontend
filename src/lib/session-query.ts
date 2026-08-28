import { api, authApi, type AppState, type SessionUser } from "./api";

export const SESSION_QUERY_KEY = ["auth-me"] as const;

export const STATE_QUERY_KEY = ["app-state"] as const;

export const sessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: (): Promise<SessionUser> => authApi.me(),
  staleTime: 30_000,
  retry: false,
} as const;

export const appStateQuery = {
  queryKey: STATE_QUERY_KEY,
  queryFn: (): Promise<AppState> => api.getState(),
  staleTime: 30_000,
  retry: 1,
} as const;
