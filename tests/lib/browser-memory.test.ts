import { afterEach, describe, expect, it } from "vitest";

import { BrowserMemory, browserMemory } from "@/lib/browser-memory";

/**
 * R2-VIS-10 — metade das chaves de localStorage nascia com o prefixo antigo
 * `architect-os:`; a migração de leitura promove o valor para `synapse:` sem
 * que a pessoa perca a preferência. [FA-05] — e nenhuma leitura ou escrita
 * derruba quem chamou quando o navegador recusa o `storage`.
 */
describe("BrowserMemory — migração de leitura architect-os: → synapse:", () => {
  afterEach(() => window.localStorage.clear());

  it("sem nenhuma das duas chaves, devolve null", () => {
    expect(browserMemory.read("synapse:x", "architect-os:x")).toBeNull();
  });

  it("só a chave nova: devolve o valor dela, sem tocar em nada", () => {
    window.localStorage.setItem("synapse:x", "novo");
    expect(browserMemory.read("synapse:x", "architect-os:x")).toBe("novo");
  });

  it("só a chave antiga: promove o valor para a nova e apaga a antiga", () => {
    window.localStorage.setItem("architect-os:x", "legado");
    expect(browserMemory.read("synapse:x", "architect-os:x")).toBe("legado");
    expect(window.localStorage.getItem("synapse:x")).toBe("legado");
    expect(window.localStorage.getItem("architect-os:x")).toBeNull();
  });

  it("as duas presentes: a nova vence, a antiga não é tocada", () => {
    window.localStorage.setItem("synapse:x", "novo");
    window.localStorage.setItem("architect-os:x", "legado");
    expect(browserMemory.read("synapse:x", "architect-os:x")).toBe("novo");
    expect(window.localStorage.getItem("architect-os:x")).toBe("legado");
  });

  it("sem chave legada, lê a chave só", () => {
    window.localStorage.setItem("synapse:y", "valor");
    expect(browserMemory.read("synapse:y")).toBe("valor");
  });
});

describe("BrowserMemory — o navegador que recusa o storage não derruba ninguém", () => {
  const bloqueada = new BrowserMemory(() => {
    throw new Error("SecurityError: the operation is insecure");
  });

  it("ler devolve null", () => {
    expect(bloqueada.read("synapse:x", "architect-os:x")).toBeNull();
  });

  it("escrever devolve false, sem lançar", () => {
    expect(bloqueada.write("synapse:x", "1")).toBe(false);
  });

  it("esquecer não lança", () => {
    expect(() => bloqueada.forget("synapse:x")).not.toThrow();
  });

  it("um storage que aceita ler mas recusa escrever também não derruba", () => {
    const soLeitura = new BrowserMemory(
      () =>
        ({
          getItem: () => null,
          setItem: () => {
            throw new Error("QuotaExceededError");
          },
          removeItem: () => {
            throw new Error("QuotaExceededError");
          },
        }) as unknown as Storage,
    );
    expect(soLeitura.write("synapse:x", "1")).toBe(false);
    expect(() => soLeitura.forget("synapse:x")).not.toThrow();
  });
});
