import { api, teamsApi } from "./api";
import type { TeamCareerLadder } from "./gateways/teams.gateway";
import { CONFIG_QUERY_STALE_TIME } from "./query-client";

export type ConfigurationRole = "ruler" | "wording";

export class ConfigurationQuery<T> {
  constructor(
    readonly role: ConfigurationRole,
    readonly queryKey: readonly string[],
    private readonly load: () => Promise<T>,
  ) {}

  get options(): {
    queryKey: readonly string[];
    queryFn: () => Promise<T>;
    staleTime: number;
  } {
    return { queryKey: this.queryKey, queryFn: this.load, staleTime: CONFIG_QUERY_STALE_TIME };
  }
}

class ConfigurationCatalog {
  readonly careerLevels = new ConfigurationQuery("ruler", ["career-levels"], api.careerLevels);

  readonly scoringBands = new ConfigurationQuery("ruler", ["config-bands"], api.bands);

  readonly operationalSettings = new ConfigurationQuery("ruler", ["config-settings"], api.settings);

  readonly curationPolicy = new ConfigurationQuery(
    "ruler",
    ["config-curation-policy"],
    api.curationPolicy,
  );

  readonly textTemplates = new ConfigurationQuery("wording", ["config-templates"], api.templates);

  readonly vocabularies = new ConfigurationQuery(
    "wording",
    ["config-vocabularies"],
    api.vocabularies,
  );

  get rulers(): readonly ConfigurationQuery<unknown>[] {
    return [this.careerLevels, this.scoringBands, this.operationalSettings, this.curationPolicy];
  }
}

export const configurationCatalog = new ConfigurationCatalog();

/**
 * A ESCADA DE CARREIRA DE UM TIME (dono, 2026-09-08). Não entra no
 * `ConfigurationCatalog` porque não é config da organização: a pergunta tem
 * PARÂMETRO — "quais níveis ESTE time usa?" —, e cada time tem a sua chave.
 *
 * A chave mora aqui, e não em quem lê, porque quem EDITA a escada precisa
 * invalidá-la: duas grafias da mesma chave em dois arquivos é o defeito em que
 * a tela salva e continua mostrando o que salvou por cima.
 */
export class TeamCareerLevelsQuery {
  static keyOf(teamId: string): readonly string[] {
    return ["team-career-levels", teamId];
  }

  static optionsOf(teamId: string): {
    queryKey: readonly string[];
    queryFn: () => Promise<TeamCareerLadder>;
    staleTime: number;
  } {
    return {
      queryKey: TeamCareerLevelsQuery.keyOf(teamId),
      queryFn: () => teamsApi.careerLadderOf(teamId),
      staleTime: CONFIG_QUERY_STALE_TIME,
    };
  }
}

export interface ConfigurationLoad {
  isPending: boolean;
  isError: boolean;
  data: unknown;
  error: unknown;
  refetch: () => unknown;
}

export class RulerConfiguration {
  constructor(private readonly loads: readonly ConfigurationLoad[]) {}

  get unavailable(): ConfigurationLoad | undefined {
    return this.loads.find((load) => load.isError && load.data === undefined);
  }

  get stillLoading(): boolean {
    return this.loads.some((load) => load.isPending);
  }
}
