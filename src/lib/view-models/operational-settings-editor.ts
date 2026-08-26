import type {
  AppSettingKey,
  AppSettingValue,
  CycleCadence,
  OperationalSettings,
} from "../operational-settings";

/** Os dois campos numéricos editáveis da aba "Operação". */
export type OperationalNumberField = "floor" | "threshold";

export const OPERATIONAL_NUMBER_FIELDS: readonly OperationalNumberField[] = ["floor", "threshold"];

/** Campo → key do `PUT /api/config/settings/:key`. */
const FIELD_TO_KEY: Record<OperationalNumberField, AppSettingKey> = {
  floor: "career.minimumQualifiedFloor",
  threshold: "training.collectiveInterventionThreshold",
};

/**
 * CFG-05 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — ViewModel do editor das
 * políticas operacionais na aba "Operação" de /settings. Segue a régua da
 * casa (payload/validação em classe testável, render na tela; mesmo formato
 * de `ScoringBandsEditor`/`CurationPolicyEditor`): a tela só liga o select
 * de cadência a `withCadence`, os inputs a `withField` e salvar a
 * `payload()`.
 *
 * A validação client-side espelha o VO do backend
 * (`OperationalSettings.create`): cadência dentro do enum (o select já
 * garante) e inteiros >= 1 para piso e limiar. O 400 `INVALID_APP_SETTING`
 * do backend continua a autoridade final.
 *
 * `payload()` devolve SÓ as keys que mudaram em relação à baseline — o
 * endpoint é um PUT por key, e nada justifica reescrever um valor igual
 * (nem poluir o audit_log com no-ops).
 *
 * Imutável de propósito (cada edição devolve um editor novo) — encaixa em
 * `useState` sem `useEffect` de sincronização.
 */
export class OperationalSettingsEditor {
  private constructor(
    private readonly baseline: OperationalSettings,
    readonly cadence: CycleCadence,
    /** Rascunho textual dos campos numéricos (input controlado; inválido fica visível até corrigir). */
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

  /** A cadência mudou em relação à efetiva? — dispara o aviso "só afeta ciclos futuros". */
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

  /** Chave i18n do erro de validação client-side, ou `null` quando o rascunho é válido. */
  get errorKey(): "config.operational.error.number" | null {
    return this.parsedNumbers() === null ? "config.operational.error.number" : null;
  }

  get isValid(): boolean {
    return this.errorKey === null;
  }

  /**
   * Os PUTs a fazer — um `{ key, value }` por setting que MUDOU; `null`
   * quando o rascunho é inválido; lista vazia quando nada mudou.
   */
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
