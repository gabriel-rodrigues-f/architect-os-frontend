import {
  EffectiveOperationalSettings,
  type AppSettingKey,
  type AppSettingValue,
  type CycleCadence,
  type OperationalSettings,
} from "../operational-settings";

export type OperationalNumberField = "floor" | "threshold" | "idleTimeout";

export const OPERATIONAL_NUMBER_FIELDS: readonly OperationalNumberField[] = [
  "floor",
  "threshold",
  "idleTimeout",
];

const FIELD_TO_KEY: Record<OperationalNumberField, AppSettingKey> = {
  floor: "career.minimumQualifiedFloor",
  threshold: "training.collectiveInterventionThreshold",
  idleTimeout: "session.idleTimeoutMinutes",
};

export const OPERATIONAL_FIELD_MINIMUM: Record<OperationalNumberField, number> = {
  floor: 1,
  threshold: 1,
  idleTimeout: EffectiveOperationalSettings.sessionIdleTimeoutMinimumMinutes,
};

export type OperationalSettingsErrorKey =
  "config.operational.error.number" | "config.operational.error.idleTimeout";

const FIELD_ERROR_KEY: Record<OperationalNumberField, OperationalSettingsErrorKey> = {
  floor: "config.operational.error.number",
  threshold: "config.operational.error.number",
  idleTimeout: "config.operational.error.idleTimeout",
};

export class OperationalSettingsEditor {
  private constructor(
    private readonly baseline: OperationalSettings,
    readonly cadence: CycleCadence,

    readonly drafts: Readonly<Record<OperationalNumberField, string>>,
  ) {}

  static from(settings: OperationalSettings): OperationalSettingsEditor {
    return new OperationalSettingsEditor(settings, settings.cycleCadence, {
      floor: String(settings.careerMinimumQualifiedFloor),
      threshold: String(settings.trainingCollectiveInterventionThreshold),
      idleTimeout: String(settings.sessionIdleTimeoutMinutes),
    });
  }

  withCadence(cadence: CycleCadence): OperationalSettingsEditor {
    return new OperationalSettingsEditor(this.baseline, cadence, this.drafts);
  }

  withField(field: OperationalNumberField, text: string): OperationalSettingsEditor {
    return new OperationalSettingsEditor(this.baseline, this.cadence, {
      ...this.drafts,
      [field]: text,
    });
  }

  get cadenceChanged(): boolean {
    return this.cadence !== this.baseline.cycleCadence;
  }

  private firstInvalidField(): OperationalNumberField | null {
    for (const field of OPERATIONAL_NUMBER_FIELDS) {
      const text = this.drafts[field];
      if (text.trim().length === 0) return field;
      const value = Number(text);
      if (!Number.isInteger(value) || value < OPERATIONAL_FIELD_MINIMUM[field]) return field;
    }
    return null;
  }

  private parsedNumbers(): Record<OperationalNumberField, number> | null {
    if (this.firstInvalidField() !== null) return null;
    const values = {} as Record<OperationalNumberField, number>;
    for (const field of OPERATIONAL_NUMBER_FIELDS) values[field] = Number(this.drafts[field]);
    return values;
  }

  get errorKey(): OperationalSettingsErrorKey | null {
    const invalid = this.firstInvalidField();
    return invalid === null ? null : FIELD_ERROR_KEY[invalid];
  }

  get isValid(): boolean {
    return this.errorKey === null;
  }

  payload(): { key: AppSettingKey; value: AppSettingValue }[] | null {
    const numbers = this.parsedNumbers();
    if (numbers === null) return null;
    const changes: { key: AppSettingKey; value: AppSettingValue }[] = [];
    if (this.cadenceChanged) changes.push({ key: "cycle.cadence", value: this.cadence });
    if (numbers.floor !== this.baseline.careerMinimumQualifiedFloor)
      changes.push({ key: FIELD_TO_KEY.floor, value: numbers.floor });
    if (numbers.threshold !== this.baseline.trainingCollectiveInterventionThreshold)
      changes.push({ key: FIELD_TO_KEY.threshold, value: numbers.threshold });
    if (numbers.idleTimeout !== this.baseline.sessionIdleTimeoutMinutes)
      changes.push({ key: FIELD_TO_KEY.idleTimeout, value: numbers.idleTimeout });
    return changes;
  }
}
