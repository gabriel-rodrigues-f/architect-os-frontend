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
      sessionIdleTimeoutMinutes: 10,
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
        record("session.idleTimeoutMinutes", 15),
      ],
    });
    expect(settings).toEqual({
      cycleCadence: "QUARTERLY",
      careerMinimumQualifiedFloor: 4,
      trainingCollectiveInterventionThreshold: 2,
      sessionIdleTimeoutMinutes: 15,
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
      sessionIdleTimeoutMinutes: 10,
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

/**
 * ONDA 31 — "o tempo mínimo sem acesso deve ser 5 minutos". O piso de verdade
 * é regra de domínio do backend; aqui ele é ECOADO: um valor servido abaixo de
 * 5 não é utilizável e cai no padrão da casa (10), como os outros campos caem
 * abaixo de 1.
 */
describe("EffectiveOperationalSettings.resolve — session.idleTimeoutMinutes", () => {
  it("o piso ecoado é 5 minutos, nomeado", () => {
    expect(EffectiveOperationalSettings.sessionIdleTimeoutMinimumMinutes).toBe(5);
  });

  it("exatamente 5 é utilizável", () => {
    const settings = EffectiveOperationalSettings.resolve({
      settings: [record("session.idleTimeoutMinutes", 5)],
    });
    expect(settings.sessionIdleTimeoutMinutes).toBe(5);
  });

  it("abaixo de 5, não inteiro ou texto cai no padrão de 10", () => {
    for (const bad of [4, 1, 0, 4.5, "5"] as const) {
      const settings = EffectiveOperationalSettings.resolve({
        settings: [record("session.idleTimeoutMinutes", bad)],
      });
      expect(settings.sessionIdleTimeoutMinutes, String(bad)).toBe(10);
    }
  });
});
