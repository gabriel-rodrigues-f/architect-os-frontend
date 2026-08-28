import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import type { AppState, SessionUser } from "./api";
import type { Architect } from "./domain";
import { defaultUiAuthorizationPolicy } from "./scope";
import { appStateQuery, sessionQuery } from "./session-query";

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

async function architectById(
  queryClient: QueryClient,
  architectId: string,
): Promise<Architect | undefined> {
  try {
    const state = await queryClient.ensureQueryData<AppState>(appStateQuery);
    return state.architects.find((architect) => architect.id === architectId);
  } catch {
    return undefined;
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

export async function requireArchitectReach({
  context,
  params,
}: {
  context: RouteGuardContext;
  params: { architectId: string };
}): Promise<void> {
  const user = await currentSession(context.queryClient);
  if (!user) return;
  if (defaultUiAuthorizationPolicy.isAdmin(user)) return;

  const architect = await architectById(context.queryClient, params.architectId);
  if (!architect) return;
  if (defaultUiAuthorizationPolicy.canActFor(user, architect)) return;
  throw redirect({ to: "/" });
}
