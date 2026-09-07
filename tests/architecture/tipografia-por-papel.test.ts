import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [T-01]/[T-02]: a escala tipográfica da casa é
 * declarada (`text-meta`, `text-label`, `text-body`…) e a do Tailwind é a
 * usada (`text-xs`, `text-sm`, `text-lg`…) — 619 linhas na medida do
 * framework, e tamanhos abaixo de 11 px escritos à mão (`text-[10px]`).
 *
 * Desde o PR 1 as classes do Tailwind são ALIASES da escala da casa
 * (`--text-sm: var(--text-body)`), então a tela já obedece a um só lugar; a
 * troca do nome pelo papel é por arquivo (PR 10). Esta catraca garante que o
 * número só desce. Prova do vermelho no dia em que nasceu: 629 ocorrências com
 * a fixture vazia (622 classes do Tailwind em 77 arquivos + os 7 `text-[10px]`/
 * `[11px]`, trocados por `text-meta` na mesma fatia).
 *
 * Regravar: `ATUALIZAR_BASELINE_TIPOGRAFIA=1 npx vitest run tests/architecture/tipografia-por-papel.test.ts`
 */
const TAMANHO_DO_FRAMEWORK = /\b(?:[a-z-]+:)*text-(?:xs|sm|base|lg|xl|[2-9]xl|\[\d+px\])/g;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "tipografia-por-papel.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_TIPOGRAFIA",
  conta: (arquivo) => arquivo.ocorrencias(TAMANHO_DO_FRAMEWORK),
  /* Só o código de tela: em `styles.css` os aliases `--text-sm` são o mecanismo, não a violação. */
  consome: (arquivo) => arquivo.eFonteDeTela && !arquivo.caminho.endsWith(".css"),
});

describe("tipografia por papel, não por medida do framework", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua reconhece a medida do framework e o tamanho arbitrário; o papel da casa passa", () => {
    expect("text-xs md:text-sm text-2xl text-[10px]".match(TAMANHO_DO_FRAMEWORK)).toEqual([
      "text-xs",
      "md:text-sm",
      "text-2xl",
      "text-[10px]",
    ]);
    expect(
      "text-meta text-body text-section text-foreground".match(TAMANHO_DO_FRAMEWORK),
    ).toBeNull();
  });

  /** [T-02]: nada abaixo de 11 px e nenhum tamanho fora da escala escrito à mão — regra dura, não baseline. */
  it("nenhum tamanho arbitrário em pixel (`text-[10px]`) sobrou em src/", () => {
    const arbitrarios = new Catraca({
      fixture: join(raizDoFrontend, "tests", "architecture", "tipografia-por-papel.fixture.json"),
      variavelDeRegravacao: "NUNCA",
      conta: (arquivo) => arquivo.ocorrencias(/\btext-\[\d+px\]/g),
    }).atual;
    expect(arbitrarios).toEqual({});
  });
});
