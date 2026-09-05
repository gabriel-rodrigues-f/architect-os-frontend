import { authApi, type SessionUser } from "./api";

export const SESSION_QUERY_KEY = ["auth-me"] as const;

export const sessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: (): Promise<SessionUser> => authApi.me(),
  staleTime: 30_000,
  retry: false,
} as const;
