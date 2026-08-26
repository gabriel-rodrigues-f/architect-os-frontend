import { afterEach, describe, expect, it } from "vitest";

import { readMigratedItem } from "@/lib/storage";

/**
 * R2-VIS-10 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — metade das chaves de
 * localStorage ainda nascia com o prefixo antigo `architect-os:`, enquanto
 * chaves mais novas já usam `synapse:`. Migração de leitura: uma sessão já
 * aberta com a chave antiga não perde a preferência salva.
 */
describe("readMigratedItem — migração de leitura architect-os: → synapse:", () => {
  afterEach(() => window.localStorage.clear());

  it("sem nenhuma das duas chaves, devolve null", () => {
    expect(readMigratedItem("synapse:x", "architect-os:x")).toBeNull();
  });

  it("só a chave nova: devolve o valor dela, sem tocar em nada", () => {
    window.localStorage.setItem("synapse:x", "novo");
    expect(readMigratedItem("synapse:x", "architect-os:x")).toBe("novo");
  });

  it("só a chave antiga: promove o valor para a nova e apaga a antiga", () => {
    window.localStorage.setItem("architect-os:x", "legado");
    expect(readMigratedItem("synapse:x", "architect-os:x")).toBe("legado");
    expect(window.localStorage.getItem("synapse:x")).toBe("legado");
    expect(window.localStorage.getItem("architect-os:x")).toBeNull();
  });

  it("as duas presentes: a nova vence, a antiga não é tocada", () => {
    window.localStorage.setItem("synapse:x", "novo");
    window.localStorage.setItem("architect-os:x", "legado");
    expect(readMigratedItem("synapse:x", "architect-os:x")).toBe("novo");
    expect(window.localStorage.getItem("architect-os:x")).toBe("legado");
  });
});
