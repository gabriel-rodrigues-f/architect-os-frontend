import { QueryClient } from "@tanstack/react-query";

export const DEFAULT_QUERY_STALE_TIME = 30_000;

export const CONFIG_QUERY_STALE_TIME = 5 * 60_000;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_QUERY_STALE_TIME,
        refetchOnWindowFocus: false,
      },
    },
  });
}
