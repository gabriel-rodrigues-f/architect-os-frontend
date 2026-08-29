import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import type { SessionUser } from "./api";
import { defaultUiAuthorizationPolicy } from "./scope";
import { sessionQuery } from "./session-query";

export interface RouteGuardContext {
  queryClient: QueryClient;
}

async function currentSession(queryClient: QueryClient): Promise<SessionUser | null> {
  if (typeof window === "undefined") return null;
  try {
    return await queryClient.ensureQueryData(sessionQuery);
  } catch {
    return null;
  }
}

export async function requireAdminReach({
  context,
}: {
  context: RouteGuardContext;
}): Promise<void> {
  const user = await currentSession(context.queryClient);
  if (!user) return;
  if (defaultUiAuthorizationPolicy.isAdmin(user)) return;
  throw redirect({ to: "/" });
}
