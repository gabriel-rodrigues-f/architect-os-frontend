export const CYCLE_CADENCES = ["SEMIANNUAL", "QUARTERLY", "ANNUAL"] as const;
export type CycleCadence = (typeof CYCLE_CADENCES)[number];

export const APP_SETTING_KEYS = [
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

export const DEFAULT_OPERATIONAL_SETTINGS: OperationalSettings = {
  cycleCadence: "SEMIANNUAL",
  careerMinimumQualifiedFloor: 3,
  trainingCollectiveInterventionThreshold: 3,
};

const intAtLeastOne = (value: AppSettingValue | undefined, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : fallback;

export function withDefaultOperationalSettings(loaded?: AppSettingsResponse): OperationalSettings {
  if (!loaded) return DEFAULT_OPERATIONAL_SETTINGS;
  const byKey = new Map(loaded.settings.map((record) => [record.key, record.value]));
  const cadence = byKey.get("cycle.cadence");
  return {
    cycleCadence: (CYCLE_CADENCES as readonly AppSettingValue[]).includes(cadence ?? "")
      ? (cadence as CycleCadence)
      : DEFAULT_OPERATIONAL_SETTINGS.cycleCadence,
    careerMinimumQualifiedFloor: intAtLeastOne(
      byKey.get("career.minimumQualifiedFloor"),
      DEFAULT_OPERATIONAL_SETTINGS.careerMinimumQualifiedFloor,
    ),
    trainingCollectiveInterventionThreshold: intAtLeastOne(
      byKey.get("training.collectiveInterventionThreshold"),
      DEFAULT_OPERATIONAL_SETTINGS.trainingCollectiveInterventionThreshold,
    ),
  };
}
