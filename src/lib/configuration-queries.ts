import { api } from "./api";
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
