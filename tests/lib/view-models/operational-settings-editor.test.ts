import { describe, expect, it } from "vitest";

import { OperationalSettingsEditor } from "@/lib/view-models";
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
};

describe("OperationalSettingsEditor", () => {
  it("nasce da baseline efetiva, válido e sem mudanças", () => {
    const editor = OperationalSettingsEditor.from(baseline);
    expect(editor.cadence).toBe("SEMIANNUAL");
    expect(editor.drafts).toEqual({ floor: "3", threshold: "3" });
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
