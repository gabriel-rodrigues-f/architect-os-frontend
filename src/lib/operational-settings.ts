export const CYCLE_CADENCES = ["SEMIANNUAL", "QUARTERLY", "ANNUAL"] as const;
export type CycleCadence = (typeof CYCLE_CADENCES)[number];

const APP_SETTING_KEYS = [
  "cycle.cadence",
  "career.minimumQualifiedFloor",
  "training.collectiveInterventionThreshold",
] as const;
export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export type AppSettingValue = string | number;

export interface OperationalSettings {
  cycleCadence: CycleCadence;
  careerMinimumQualifiedFloor: number;
  trainingCollectiveInterventionThreshold: number;
}

export interface AppSettingRecord {
  key: string;
  value: AppSettingValue;
  valueType: string;
  scope: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AppSettingsResponse {
  settings: AppSettingRecord[];
}

class ServedAppSettings {
  private constructor(private readonly byKey: Map<string, AppSettingValue>) {}

  static in(response: AppSettingsResponse): ServedAppSettings {
    return new ServedAppSettings(
      new Map(response.settings.map((record) => [record.key, record.value])),
    );
  }

  cadenceOr(fallback: CycleCadence): CycleCadence {
    const served = this.byKey.get("cycle.cadence");
    return (CYCLE_CADENCES as readonly AppSettingValue[]).includes(served ?? "")
      ? (served as CycleCadence)
      : fallback;
  }

  countOr(key: AppSettingKey, fallback: number): number {
    const served = this.byKey.get(key);
    return typeof served === "number" && Number.isInteger(served) && served >= 1
      ? served
      : fallback;
  }
}

export class EffectiveOperationalSettings {
  static readonly defaults: OperationalSettings = {
    cycleCadence: "SEMIANNUAL",
    careerMinimumQualifiedFloor: 3,
    trainingCollectiveInterventionThreshold: 3,
  };

  static resolve(loaded?: AppSettingsResponse): OperationalSettings {
    const { defaults } = EffectiveOperationalSettings;
    if (!loaded) return defaults;
    const served = ServedAppSettings.in(loaded);
    return {
      cycleCadence: served.cadenceOr(defaults.cycleCadence),
      careerMinimumQualifiedFloor: served.countOr(
        "career.minimumQualifiedFloor",
        defaults.careerMinimumQualifiedFloor,
      ),
      trainingCollectiveInterventionThreshold: served.countOr(
        "training.collectiveInterventionThreshold",
        defaults.trainingCollectiveInterventionThreshold,
      ),
    };
  }
}
