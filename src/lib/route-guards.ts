import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import type { SessionUser } from "./api";
import { defaultUiAuthorizationPolicy, type UiAuthorizationPolicy } from "./scope";
import { sessionQuery } from "./session-query";

export interface RouteGuardContext {
  queryClient: QueryClient;
}

type RouteGuard = (args: { context: RouteGuardContext }) => Promise<void>;

type CareerFileRouteGuard = (args: {
  context: RouteGuardContext;
  params: { architectId: string };
}) => Promise<void>;

class NavigationBarrier {
  constructor(private readonly policy: UiAuthorizationPolicy) {}

  requireAdminReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.isAdmin(user));

  requireLeadReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.canConfigureAnyTeamRules(user));

  requireCalibrationReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.canCalibrate(user));

  requireLeadershipReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.isLeadership(user));

  requireCareerFileReach: CareerFileRouteGuard = ({ context, params }) =>
    this.requireReach(context, (user) => this.policy.canOpenCareerFileOf(user, params.architectId));

  private async requireReach(
    context: RouteGuardContext,
    allows: (user: SessionUser) => boolean,
  ): Promise<void> {
    const user = await this.currentSession(context.queryClient);
    if (!user) return;
    if (allows(user)) return;
    throw redirect({ to: "/" });
  }

  private async currentSession(queryClient: QueryClient): Promise<SessionUser | null> {
    if (typeof window === "undefined") return null;
    try {
      return await queryClient.ensureQueryData(sessionQuery);
    } catch {
      return null;
    }
  }
}

const navigationBarrier = new NavigationBarrier(defaultUiAuthorizationPolicy);

export const requireAdminReach = navigationBarrier.requireAdminReach;
export const requireLeadReach = navigationBarrier.requireLeadReach;
export const requireCalibrationReach = navigationBarrier.requireCalibrationReach;
export const requireLeadershipReach = navigationBarrier.requireLeadershipReach;
export const requireCareerFileReach = navigationBarrier.requireCareerFileReach;
