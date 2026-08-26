import type {
  AppSettingKey,
  AppSettingValue,
  CycleCadence,
  OperationalSettings,
} from "../operational-settings";

export type OperationalNumberField = "floor" | "threshold";

export const OPERATIONAL_NUMBER_FIELDS: readonly OperationalNumberField[] = ["floor", "threshold"];

const FIELD_TO_KEY: Record<OperationalNumberField, AppSettingKey> = {
  floor: "career.minimumQualifiedFloor",
  threshold: "training.collectiveInterventionThreshold",
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

  private parsedNumbers(): Record<OperationalNumberField, number> | null {
    const values = {} as Record<OperationalNumberField, number>;
    for (const field of OPERATIONAL_NUMBER_FIELDS) {
      const text = this.drafts[field];
      if (text.trim().length === 0) return null;
      const value = Number(text);
      if (!Number.isInteger(value) || value < 1) return null;
      values[field] = value;
    }
    return values;
  }

  get errorKey(): "config.operational.error.number" | null {
    return this.parsedNumbers() === null ? "config.operational.error.number" : null;
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
    return changes;
  }
}
