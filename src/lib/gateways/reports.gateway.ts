import { careerStatementTeamTransitionsResponseSchema } from "../api-schemas";
import type { EvolutionFilters } from "../domain";
import type { ApiClient } from "../api-client";

export interface CalendarRange {
  readonly from: string;
  readonly to: string;
}

export interface TeamTransitionRecord {
  id: string;
  occurredOn: string;
  fromTeamName: string | null;
  toTeamName: string;
  reason: string;
}

export interface ReportsGateway {
  exportEvolutionPdf(
    architectId: string,
    filters: EvolutionFilters,
  ): Promise<{ blob: Blob; filename: string }>;
  teamTransitionsOf(architectId: string, range: CalendarRange): Promise<TeamTransitionRecord[]>;
}

export class HttpReportsGateway implements ReportsGateway {
  constructor(private readonly client: ApiClient) {}

  exportEvolutionPdf = (
    architectId: string,
    filters: EvolutionFilters,
  ): Promise<{ blob: Blob; filename: string }> =>
    this.client.requestBlob("/reports/evolution/pdf", { architectId, ...filters });

  teamTransitionsOf = (
    architectId: string,
    range: CalendarRange,
  ): Promise<TeamTransitionRecord[]> =>
    this.client
      .post<unknown>("/reports/career-statement", {
        architectId,
        range,
        kinds: ["teamTransition"],
      })
      .then((data) =>
        careerStatementTeamTransitionsResponseSchema
          .parse(data)
          .entries.map(({ kind: _kind, ...record }) => record),
      );
}

export class InMemoryReportsGateway implements ReportsGateway {
  constructor(
    private readonly transitionsByArchitect: ReadonlyMap<string, readonly TeamTransitionRecord[]>,
  ) {}

  exportEvolutionPdf = (architectId: string): Promise<{ blob: Blob; filename: string }> =>
    Promise.resolve({ blob: new Blob(), filename: `evolucao-${architectId}.pdf` });

  teamTransitionsOf = (
    architectId: string,
    range: CalendarRange,
  ): Promise<TeamTransitionRecord[]> =>
    Promise.resolve(
      (this.transitionsByArchitect.get(architectId) ?? [])
        .filter((record) => record.occurredOn >= range.from && record.occurredOn <= range.to)
        .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn)),
    );
}
