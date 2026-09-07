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

  /** Catálogo e o que mais é do sistema: SUPPORT (o antigo admin) e ADMIN. */
  requireSystemOperatorReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.operatesTheSystem(user));

  requireLeadReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.canConfigureAnyTeamRules(user));

  requireCalibrationReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.canCalibrate(user));

  requireLeadershipReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.isLeadership(user));

  requireTeamAnalysisReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.canAnalyzeTeam(user));

  /** Usuários e Times: o administrador e o gerente com vínculo. */
  requirePeopleAdministrationReach: RouteGuard = ({ context }) =>
    this.requireReach(context, (user) => this.policy.canAdministerPeople(user));

  requireCareerTabsReach: CareerFileRouteGuard = ({ context, params }) =>
    this.requireReach(context, (user) => this.policy.canOpenCareerTabsOf(user, params.architectId));

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

export const requireSystemOperatorReach = navigationBarrier.requireSystemOperatorReach;
export const requireLeadReach = navigationBarrier.requireLeadReach;
export const requireCalibrationReach = navigationBarrier.requireCalibrationReach;
export const requireLeadershipReach = navigationBarrier.requireLeadershipReach;
export const requireTeamAnalysisReach = navigationBarrier.requireTeamAnalysisReach;
export const requireCareerTabsReach = navigationBarrier.requireCareerTabsReach;
export const requirePeopleAdministrationReach = navigationBarrier.requirePeopleAdministrationReach;
