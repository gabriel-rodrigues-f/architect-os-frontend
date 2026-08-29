import { describe, expect, it } from "vitest";

import { defaultStranglerLedger } from "@/lib/state-contexts";

/**
 * ADR-0011, fase 1 — o livro-razão do estrangulamento: SÓ o painel, /team e
 * o índice do perfil do arquiteto saem do blob nesta fase. A sub-rota
 * /evolution e todas as demais telas CONTINUAM no /state (fase 2). Errar o
 * casamento aqui liga o modo errado do StoreProvider e quebra tela.
 */
describe("livro-razão do estrangulamento — fase 1", () => {
  it("estrangula exatamente painel, /team e o índice do perfil", () => {
    expect(defaultStranglerLedger.isStrangled("/")).toBe(true);
    expect(defaultStranglerLedger.isStrangled("/team")).toBe(true);
    expect(defaultStranglerLedger.isStrangled("/team/")).toBe(true);
    expect(defaultStranglerLedger.isStrangled("/architects/ana")).toBe(true);
    expect(defaultStranglerLedger.isStrangled("/architects/ana/")).toBe(true);
  });

  it("deixa o resto no blob — fase 2 é outra fatia", () => {
    expect(defaultStranglerLedger.isStrangled("/architects/ana/evolution")).toBe(false);
    expect(defaultStranglerLedger.isStrangled("/gap-analysis")).toBe(false);
    expect(defaultStranglerLedger.isStrangled("/progression")).toBe(false);
    expect(defaultStranglerLedger.isStrangled("/settings")).toBe(false);
    expect(defaultStranglerLedger.isStrangled("/teams")).toBe(false);
  });
});
