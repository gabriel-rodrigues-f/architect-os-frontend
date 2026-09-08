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
    professionalId: string,
    filters: EvolutionFilters,
  ): Promise<{ blob: Blob; filename: string }>;
  teamTransitionsOf(professionalId: string, range: CalendarRange): Promise<TeamTransitionRecord[]>;
}

export class HttpReportsGateway implements ReportsGateway {
  constructor(private readonly client: ApiClient) {}

  exportEvolutionPdf = (
    professionalId: string,
    filters: EvolutionFilters,
  ): Promise<{ blob: Blob; filename: string }> =>
    this.client.requestBlob("/reports/evolution/pdf", { professionalId, ...filters });

  teamTransitionsOf = (
    professionalId: string,
    range: CalendarRange,
  ): Promise<TeamTransitionRecord[]> =>
    this.client
      .post<unknown>("/reports/career-statement", {
        professionalId,
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
    private readonly transitionsByProfessional: ReadonlyMap<
      string,
      readonly TeamTransitionRecord[]
    >,
  ) {}

  exportEvolutionPdf = (professionalId: string): Promise<{ blob: Blob; filename: string }> =>
    Promise.resolve({ blob: new Blob(), filename: `evolucao-${professionalId}.pdf` });

  teamTransitionsOf = (
    professionalId: string,
    range: CalendarRange,
  ): Promise<TeamTransitionRecord[]> =>
    Promise.resolve(
      (this.transitionsByProfessional.get(professionalId) ?? [])
        .filter((record) => record.occurredOn >= range.from && record.occurredOn <= range.to)
        .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn)),
    );
}
