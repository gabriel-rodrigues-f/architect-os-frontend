import { describe, expect, it } from "vitest";

import { OPERATIONAL_FIELD_MINIMUM, OperationalSettingsEditor } from "@/lib/view-models";
import type { OperationalSettings } from "@/lib/operational-settings";

/**
 * CFG-05 (admin UI) — ViewModel da aba "Operação": validação client-side
 * (inteiros >= 1) espelhando o VO do backend, aviso de cadência e payload
 * de PUTs SÓ com as keys que mudaram.
 */

const baseline: OperationalSettings = {
  cycleCadence: "SEMIANNUAL",
  careerMinimumQualifiedFloor: 3,
  trainingCollectiveInterventionThreshold: 3,
  sessionIdleTimeoutMinutes: 10,
};

describe("OperationalSettingsEditor", () => {
  it("nasce da baseline efetiva, válido e sem mudanças", () => {
    const editor = OperationalSettingsEditor.from(baseline);
    expect(editor.cadence).toBe("SEMIANNUAL");
    expect(editor.drafts).toEqual({ floor: "3", threshold: "3", idleTimeout: "10" });
    expect(editor.isValid).toBe(true);
    expect(editor.cadenceChanged).toBe(false);
    expect(editor.payload()).toEqual([]);
  });

  it("payload traz UM {key, value} por setting alterada — e só as alteradas", () => {
    const editor = OperationalSettingsEditor.from(baseline)
      .withCadence("QUARTERLY")
      .withField("threshold", "2");
    expect(editor.cadenceChanged).toBe(true);
    expect(editor.payload()).toEqual([
      { key: "cycle.cadence", value: "QUARTERLY" },
      { key: "training.collectiveInterventionThreshold", value: 2 },
    ]);
  });

  it("piso alterado sozinho vira só o PUT do piso", () => {
    const editor = OperationalSettingsEditor.from(baseline).withField("floor", "4");
    expect(editor.payload()).toEqual([{ key: "career.minimumQualifiedFloor", value: 4 }]);
  });

  it("inteiro < 1, não inteiro ou vazio invalida (mesma régua do VO do backend)", () => {
    for (const bad of ["0", "-1", "2.5", "", "abc"]) {
      const editor = OperationalSettingsEditor.from(baseline).withField("floor", bad);
      expect(editor.errorKey).toBe("config.operational.error.number");
      expect(editor.isValid).toBe(false);
      expect(editor.payload()).toBeNull();
    }
  });

  it("voltar a cadência para a baseline desarma a mudança", () => {
    const editor = OperationalSettingsEditor.from(baseline)
      .withCadence("ANNUAL")
      .withCadence("SEMIANNUAL");
    expect(editor.cadenceChanged).toBe(false);
    expect(editor.payload()).toEqual([]);
  });
});

/**
 * ONDA 31 — o tempo máximo sem atividade entra como irmão dos outros dois
 * números, mas com o piso do dono (5) ecoado na validação e mensagem própria:
 * "maiores ou iguais a 1" mentiria para este campo.
 */
describe("OperationalSettingsEditor — tempo máximo sem atividade", () => {
  it("o piso ecoado na tela é 5, e os irmãos continuam em 1", () => {
    expect(OPERATIONAL_FIELD_MINIMUM).toEqual({ floor: 1, threshold: 1, idleTimeout: 5 });
  });

  it("alterar só o tempo vira só o PUT de session.idleTimeoutMinutes", () => {
    const editor = OperationalSettingsEditor.from(baseline).withField("idleTimeout", "7");
    expect(editor.isValid).toBe(true);
    expect(editor.payload()).toEqual([{ key: "session.idleTimeoutMinutes", value: 7 }]);
  });

  it("exatamente 5 é válido", () => {
    const editor = OperationalSettingsEditor.from(baseline).withField("idleTimeout", "5");
    expect(editor.isValid).toBe(true);
    expect(editor.payload()).toEqual([{ key: "session.idleTimeoutMinutes", value: 5 }]);
  });

  it("abaixo de 5 invalida com a mensagem do piso, não a dos irmãos", () => {
    for (const bad of ["4", "1", "0", "4.5", "", "abc"]) {
      const editor = OperationalSettingsEditor.from(baseline).withField("idleTimeout", bad);
      expect(editor.errorKey, bad).toBe("config.operational.error.idleTimeout");
      expect(editor.isValid).toBe(false);
      expect(editor.payload()).toBeNull();
    }
  });

  it("os irmãos continuam com a mensagem deles quando só eles estão errados", () => {
    const editor = OperationalSettingsEditor.from(baseline).withField("threshold", "0");
    expect(editor.errorKey).toBe("config.operational.error.number");
  });
});
