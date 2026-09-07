import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [F-02]: 227 `title=` nativos contra 10
 * `Tooltip`. O `title` não aparece no toque, não abre por teclado e, no
 * `LevelBadge`, era a ÚNICA forma de ler o nome do nível.
 *
 * Política: `title=` só onde não há `Tooltip` acessível — como redundância
 * de `aria-label` em botão-ícone, nunca como o lugar da informação. Quem
 * precisa explicar um valor usa o `Tooltip` (ou o `tooltip` do `Chip`), que
 * também deixa uma cópia legível para o leitor de tela. O número por arquivo
 * só desce. Prova do vermelho no dia em que nasceu: 227 ocorrências com a
 * fixture vazia.
 *
 * Regravar: `ATUALIZAR_BASELINE_TITLE=1 npx vitest run tests/architecture/title-por-arquivo.test.ts`
 */
const TITLE_NATIVO = /\stitle=/g;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "title-por-arquivo.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_TITLE",
  conta: (arquivo) => arquivo.ocorrencias(TITLE_NATIVO),
});

describe("title= nativo por arquivo só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua conta o atributo e ignora a palavra em prop ou chave", () => {
    expect('<span title={x}> <a title="y">'.match(TITLE_NATIVO)).toHaveLength(2);
    expect("{ title: x } page.title subtitle=".match(TITLE_NATIVO)).toBeNull();
  });
});
