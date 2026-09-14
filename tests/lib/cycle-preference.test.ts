import { describe, expect, it } from "vitest";

import { CyclePreference } from "@/lib/cycle-preference";

/**
 * Dono, 2026-09-10: "quero que todos os perfis possam mudar o ciclo enquanto
 * logados. Essa mudança deve valer apenas para o seu perfil." A escolha é por
 * conta, e quem não escolheu (ou escolheu um ciclo que já não existe) lê o
 * ciclo ativo da organização.
 */
function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("CyclePreference — o ciclo em foco é de cada pessoa", () => {
  it("sem escolha, lê o ativo da organização", () => {
    expect(CyclePreference.resolve(null, "2026-h2")).toBe("2026-h2");
    expect(CyclePreference.resolve("", "2026-h2")).toBe("2026-h2");
  });

  it("a escolha vale quando o ciclo ainda existe; quando sumiu, volta ao ativo", () => {
    expect(CyclePreference.resolve("2026-h1", "2026-h2", ["2026-h1", "2026-h2"])).toBe("2026-h1");
    expect(CyclePreference.resolve("2025-h2", "2026-h2", ["2026-h1", "2026-h2"])).toBe("2026-h2");
    expect(CyclePreference.resolve("2026-h1", "2026-h2")).toBe("2026-h1");
  });

  it("a escolha de uma conta não vaza para outra no mesmo navegador", () => {
    const storage = memoryStorage();
    new CyclePreference(storage, { id: "ana" }).write("2026-h1");
    expect(new CyclePreference(storage, { id: "ana" }).read()).toBe("2026-h1");
    expect(new CyclePreference(storage, { id: "bruno" }).read()).toBeNull();
  });

  it("armazenamento que recusa não derruba a leitura", () => {
    const refusing = {
      getItem: () => {
        throw new Error("negado");
      },
      setItem: () => {
        throw new Error("negado");
      },
    };
    const preference = new CyclePreference(refusing, { id: "ana" });
    preference.write("2026-h1");
    expect(preference.read()).toBeNull();
  });
});
