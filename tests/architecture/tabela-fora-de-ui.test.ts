import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [F-05]: 18 `<table>` em 15 arquivos, nenhuma
 * primitiva — a linha de cabeçalho copiada 14 vezes, `py-2` numa tela e
 * `py-3` na outra. A primitiva agora existe (`components/ui/table.tsx`:
 * `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`, `TCaption`); a migração das
 * rotas é por arquivo (PR 10) e esta catraca garante que o número de
 * `<table` fora de `components/ui` só desce. Prova do vermelho no dia em que
 * nasceu: 18 ocorrências em 15 arquivos com a fixture vazia.
 *
 * Regravar: `ATUALIZAR_BASELINE_TABELA=1 npx vitest run tests/architecture/tabela-fora-de-ui.test.ts`
 */
const TABELA_CRUA = /<table\b/g;
const PRIMITIVAS = `${join("src", "components", "ui")}${sep}`;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "tabela-fora-de-ui.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_TABELA",
  conta: (arquivo) => arquivo.ocorrencias(TABELA_CRUA),
  consome: (arquivo) => arquivo.eFonteDeTela && !arquivo.caminho.startsWith(PRIMITIVAS),
});

describe("tabela crua fora de components/ui só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua conta a tag crua e ignora a primitiva", () => {
    expect("<table className><Table><TBody>".match(TABELA_CRUA)).toEqual(["<table"]);
  });
});
