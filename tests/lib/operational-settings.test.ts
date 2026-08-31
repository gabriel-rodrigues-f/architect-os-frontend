import { describe, expect, it } from "vitest";

import { EffectiveOperationalSettings, type AppSettingRecord } from "@/lib/operational-settings";

/**
 * CFG-05 — o fallback das políticas operacionais: byte-idêntico ao seed do
 * backend ({SEMIANNUAL, 3, 3} — os literais que o código tinha hardcoded) e
 * resiliente campo a campo (key ausente ou de tipo errado cai no default
 * DAQUELE campo, sem derrubar os demais).
 */

const record = (key: string, value: string | number): AppSettingRecord => ({
  key,
  value,
  valueType: typeof value === "number" ? "int" : "enum",
  scope: "operational",
  description: null,
  updatedAt: "2026-08-26T00:00:00Z",
  updatedBy: null,
});

describe("EffectiveOperationalSettings.resolve", () => {
  it("sem resposta (consulta em voo/falha) devolve o default do seed", () => {
    expect(EffectiveOperationalSettings.resolve(undefined)).toEqual({
      cycleCadence: "SEMIANNUAL",
      careerMinimumQualifiedFloor: 3,
      trainingCollectiveInterventionThreshold: 3,
    });
    expect(EffectiveOperationalSettings.resolve(undefined)).toEqual(
      EffectiveOperationalSettings.defaults,
    );
  });

  it("resposta completa vira a forma plana efetiva", () => {
    const settings = EffectiveOperationalSettings.resolve({
      settings: [
        record("cycle.cadence", "QUARTERLY"),
        record("career.minimumQualifiedFloor", 4),
        record("training.collectiveInterventionThreshold", 2),
      ],
    });
    expect(settings).toEqual({
      cycleCadence: "QUARTERLY",
      careerMinimumQualifiedFloor: 4,
      trainingCollectiveInterventionThreshold: 2,
    });
  });

  it("key ausente ou inválida cai no default do CAMPO, sem afetar as outras", () => {
    const settings = EffectiveOperationalSettings.resolve({
      settings: [
        record("cycle.cadence", "MONTHLY"), // fora do enum
        record("training.collectiveInterventionThreshold", 5),
        // career.minimumQualifiedFloor ausente (ambiente recém-migrado)
      ],
    });
    expect(settings).toEqual({
      cycleCadence: "SEMIANNUAL",
      careerMinimumQualifiedFloor: 3,
      trainingCollectiveInterventionThreshold: 5,
    });
  });

  it("inteiro < 1 ou não inteiro não é utilizável — cai no default", () => {
    const settings = EffectiveOperationalSettings.resolve({
      settings: [
        record("career.minimumQualifiedFloor", 0),
        record("training.collectiveInterventionThreshold", 2.5),
      ],
    });
    expect(settings.careerMinimumQualifiedFloor).toBe(3);
    expect(settings.trainingCollectiveInterventionThreshold).toBe(3);
  });
});
