import { afterEach, describe, expect, it } from "vitest";

import { BrowserMemory } from "@/lib/browser-memory";
import { SessionEndMemory, SessionEndReason } from "@/lib/session-end-reason";

/**
 * PR 9 ([FA-01], [FA-02]) — a sessão acaba por três motivos, e só dois deles
 * pedem explicação na tela de login: inatividade e expiração. "Sair" é ato da
 * pessoa, não precisa de aviso. A razão é um VALOR fechado (não uma string
 * solta), e a memória de aba a guarda para sobreviver ao F5 — nunca a URL.
 */
describe("SessionEndReason — o valor", () => {
  it("só existem três razões, e cada uma sabe se explica a si mesma no login", () => {
    expect(SessionEndReason.manual.explainsItself).toBe(false);
    expect(SessionEndReason.idle.explainsItself).toBe(true);
    expect(SessionEndReason.expired.explainsItself).toBe(true);
  });

  it("cada razão que explica leva a própria chave de tradução", () => {
    expect(SessionEndReason.idle.messageKey).toBe("login.sessionEnded.idle");
    expect(SessionEndReason.expired.messageKey).toBe("login.sessionEnded.expired");
    expect(SessionEndReason.manual.messageKey).toBeNull();
  });

  it("reconstrói a razão a partir do nome guardado, e recusa o que não conhece", () => {
    expect(SessionEndReason.of("idle")).toBe(SessionEndReason.idle);
    expect(SessionEndReason.of("expired")).toBe(SessionEndReason.expired);
    expect(SessionEndReason.of("manual")).toBe(SessionEndReason.manual);
    expect(SessionEndReason.of("qualquer-coisa")).toBeNull();
    expect(SessionEndReason.of(null)).toBeNull();
  });
});

describe("SessionEndMemory — a memória da aba", () => {
  const memory = new SessionEndMemory(new BrowserMemory(() => window.sessionStorage));

  afterEach(() => window.sessionStorage.clear());

  it("sem nada guardado, não há razão", () => {
    expect(memory.recall()).toBeNull();
  });

  it("guarda a razão que explica e a devolve depois — o F5 não a apaga", () => {
    memory.remember(SessionEndReason.idle);
    expect(memory.recall()).toBe(SessionEndReason.idle);
    expect(memory.recall()).toBe(SessionEndReason.idle);
  });

  it("guarda em sessionStorage, com a chave da casa, nunca na URL", () => {
    memory.remember(SessionEndReason.expired);
    expect(window.sessionStorage.getItem(SessionEndMemory.STORAGE_KEY)).toBe("expired");
    expect(window.location.search).toBe("");
  });

  it("o logout manual apaga qualquer razão anterior — 'Sair' nunca mostra aviso", () => {
    memory.remember(SessionEndReason.idle);
    memory.remember(SessionEndReason.manual);
    expect(memory.recall()).toBeNull();
    expect(window.sessionStorage.getItem(SessionEndMemory.STORAGE_KEY)).toBeNull();
  });

  it("clear esquece a razão", () => {
    memory.remember(SessionEndReason.expired);
    memory.clear();
    expect(memory.recall()).toBeNull();
  });

  it("um valor estranho no storage é ignorado", () => {
    window.sessionStorage.setItem(SessionEndMemory.STORAGE_KEY, "lixo");
    expect(memory.recall()).toBeNull();
  });

  it("navegador que recusa o storage não derruba quem chamou", () => {
    const recusa = new SessionEndMemory(
      new BrowserMemory(() => {
        throw new Error("storage bloqueado");
      }),
    );
    expect(() => recusa.remember(SessionEndReason.idle)).not.toThrow();
    expect(recusa.recall()).toBeNull();
  });
});
