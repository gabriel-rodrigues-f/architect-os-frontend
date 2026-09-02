import { teamTransitionsResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { DataOrigin, OriginatedData } from "./data-origin";

export interface CalendarPeriod {
  readonly from: string;
  readonly to: string;
}

export interface LevelTransitionPair {
  fromRole: string;
  toRole: string;
  transitions: number;
  averageDaysInOriginLevel: number | null;
}

export interface TeamTransitionsRow {
  teamId: string;
  teamName: string;
  activeArchitects: number;
  transitions: number;
  transitionsPerActiveArchitect: number | null;
  measuredOrigins: number;
  averageDaysInOriginLevel: number | null;
  pairs: LevelTransitionPair[];
}

export interface TeamTransitions extends OriginatedData {
  readonly period: CalendarPeriod;
  readonly teams: readonly TeamTransitionsRow[];
  readonly withoutRecordedTeam: number | null;
}

export interface TeamTransitionsScope {
  readonly period: CalendarPeriod;
  readonly teamIds?: readonly string[];
}

export interface TeamTransitionsGateway {
  readonly dataOrigin: DataOrigin;
  compareTeamTransitions(scope: TeamTransitionsScope): Promise<TeamTransitions>;
}

export class TeamTransitionsServiceOrder {
  byTeamName(first: TeamTransitionsRow, second: TeamTransitionsRow): number {
    return (
      first.teamName.localeCompare(second.teamName, "pt-BR", { sensitivity: "base" }) ||
      first.teamId.localeCompare(second.teamId, "en")
    );
  }
}

export class HttpTeamTransitionsGateway implements TeamTransitionsGateway {
  readonly dataOrigin: DataOrigin = "organization";

  constructor(private readonly client: ApiClient) {}

  compareTeamTransitions = (scope: TeamTransitionsScope): Promise<TeamTransitions> =>
    this.client
      .post<unknown>("/analytics/team-transitions", {
        period: scope.period,
        ...(scope.teamIds ? { teamIds: scope.teamIds } : {}),
      })
      .then((data) => ({
        ...teamTransitionsResponseSchema.parse(data),
        dataOrigin: this.dataOrigin,
      }));
}

export class InMemoryTeamTransitionsGateway implements TeamTransitionsGateway {
  readonly dataOrigin: DataOrigin = "demonstration";

  private readonly order = new TeamTransitionsServiceOrder();

  constructor(
    private readonly rows: readonly TeamTransitionsRow[],
    private readonly withoutRecordedTeam: number | null,
  ) {}

  compareTeamTransitions = (scope: TeamTransitionsScope): Promise<TeamTransitions> => {
    const requested = scope.teamIds ? new Set(scope.teamIds) : null;
    const teams = this.rows
      .filter((row) => requested === null || requested.has(row.teamId))
      .sort((first, second) => this.order.byTeamName(first, second));
    return Promise.resolve({
      period: scope.period,
      teams,
      withoutRecordedTeam: this.withoutRecordedTeam,
      dataOrigin: this.dataOrigin,
    });
  };
}
