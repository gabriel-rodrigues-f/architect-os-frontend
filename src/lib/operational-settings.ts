export const CYCLE_CADENCES = ["SEMIANNUAL", "QUARTERLY", "ANNUAL"] as const;
export type CycleCadence = (typeof CYCLE_CADENCES)[number];

const APP_SETTING_KEYS = [
  "cycle.cadence",
  "career.minimumQualifiedFloor",
  "training.collectiveInterventionThreshold",
  "session.idleTimeoutMinutes",
] as const;
export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export type AppSettingValue = string | number;

export interface OperationalSettings {
  cycleCadence: CycleCadence;
  careerMinimumQualifiedFloor: number;
  trainingCollectiveInterventionThreshold: number;
  sessionIdleTimeoutMinutes: number;
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

  countOr(key: AppSettingKey, fallback: number, minimum = 1): number {
    const served = this.byKey.get(key);
    return typeof served === "number" && Number.isInteger(served) && served >= minimum
      ? served
      : fallback;
  }
}

export class EffectiveOperationalSettings {
  static readonly sessionIdleTimeoutMinimumMinutes = 5;

  static readonly defaults: OperationalSettings = {
    cycleCadence: "SEMIANNUAL",
    careerMinimumQualifiedFloor: 3,
    trainingCollectiveInterventionThreshold: 3,
    sessionIdleTimeoutMinutes: 10,
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
      sessionIdleTimeoutMinutes: served.countOr(
        "session.idleTimeoutMinutes",
        defaults.sessionIdleTimeoutMinutes,
        EffectiveOperationalSettings.sessionIdleTimeoutMinimumMinutes,
      ),
    };
  }
}
