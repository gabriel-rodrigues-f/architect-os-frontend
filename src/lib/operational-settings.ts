/**
 * CFG-05 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.1 tabela 5 / B5, B6, B9) — as
 * políticas operacionais ESCALARES (`app_settings`) deixaram de ser literais
 * no código: a autoridade é a tabela do backend, servida por
 * `GET /api/config/settings` (`ConfigGateway.settings`). Este módulo é o
 * lado do frontend dessa fatia, no MESMO formato de `scoring-bands.ts`
 * (CFG-02), `text-templates.ts` (CFG-03) e `curation-policy.ts` (CFG-04):
 *
 * - o TIPO espelha o domínio do backend
 *   (`backend/src/modules/config/domain/app-settings.ts`,
 *   `OperationalSettingsValues` — a forma plana);
 * - `DEFAULT_OPERATIONAL_SETTINGS` é o ÚNICO lugar onde os valores antigos
 *   (H1/H2 semestral, piso 3, `n.people >= 3`) sobrevivem, como fallback
 *   byte-idêntico ao seed da migration do backend — enquanto a consulta não
 *   resolve (ou falha), tudo se comporta exatamente como antes, sem flash;
 * - quem quer as settings EFETIVAS (servidor com fallback) usa
 *   `useOperationalSettings` (`store.tsx`).
 *
 * O front nunca REVALIDA os valores contra regra de negócio (isso é o VO
 * `OperationalSettings` do backend, 400 `INVALID_APP_SETTING`); aqui só se
 * decide, campo a campo, se o que veio é utilizável — valor faltando ou de
 * tipo errado cai no default daquele campo, nunca derruba a tela.
 */

/** Espelho de `CYCLE_CADENCES` do backend — o enum da key `cycle.cadence`. */
export const CYCLE_CADENCES = ["SEMIANNUAL", "QUARTERLY", "ANNUAL"] as const;
export type CycleCadence = (typeof CYCLE_CADENCES)[number];

/** As três keys do modelo — espelho de `APP_SETTING_KEYS` do backend. */
export const APP_SETTING_KEYS = [
  "cycle.cadence",
  "career.minimumQualifiedFloor",
  "training.collectiveInterventionThreshold",
] as const;
export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

/** Valor tipado de uma setting — cadência é string do enum; os demais, int. */
export type AppSettingValue = string | number;

/** Forma plana efetiva — espelho de `OperationalSettingsValues` do backend. */
export interface OperationalSettings {
  cycleCadence: CycleCadence;
  careerMinimumQualifiedFloor: number;
  trainingCollectiveInterventionThreshold: number;
}

/**
 * Uma linha do `GET /api/config/settings` — valor tipado + metadados (o
 * shape exato do `AppSettingRecord` do backend; os metadados vêm junto mas
 * só `key`/`value` alimentam o comportamento).
 */
export interface AppSettingRecord {
  key: string;
  value: AppSettingValue;
  valueType: string;
  scope: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** O envelope do GET — `{ settings: [...] }`, como o controller serializa. */
export interface AppSettingsResponse {
  settings: AppSettingRecord[];
}

/**
 * O fallback único — espelho EXATO do seed da migration do backend
 * (`DEFAULT_APP_SETTINGS` em `app-settings.ts`, que por sua vez espelha os
 * literais que o código tinha antes da fatia). Se o seed mudar lá, este
 * arquivo muda junto; os testes de fallback denunciam divergência.
 */
export const DEFAULT_OPERATIONAL_SETTINGS: OperationalSettings = {
  cycleCadence: "SEMIANNUAL",
  careerMinimumQualifiedFloor: 3,
  trainingCollectiveInterventionThreshold: 3,
};

const intAtLeastOne = (value: AppSettingValue | undefined, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : fallback;

/**
 * Settings efetivas = servidor quando carregado, default por CAMPO enquanto
 * não (mesmo espírito de `withDefaultScoringBands`/`withDefaultCurationPolicy`
 * — sem flash: com o seed default o comportamento é byte-idêntico ao
 * hardcoded). Campo a campo de propósito: uma key ausente/estranha num
 * ambiente recém-migrado não pode invalidar as outras duas.
 */
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
