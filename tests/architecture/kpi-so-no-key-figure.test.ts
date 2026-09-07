import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [D-01]: dois cartões de KPI para o mesmo
 * conceito (`StatCard` a 24 px, `KeyFigureCard` a 44 px) e seis valores
 * numéricos escritos à mão no Painel. O número-síntese é UM objeto —
 * `KeyFigure` — e o `StatCard` virou um apelido de `KeyFigureCard size="sm"`
 * até os 17 usos migrarem (PR 10).
 *
 * A régua conta o valor grande escrito à mão (display + tamanho + tabular)
 * fora de `KeyFigure.tsx`; só desce. Prova do vermelho no dia em que nasceu:
 * 9 ocorrências em 4 arquivos com a fixture vazia.
 *
 * Regravar: `ATUALIZAR_BASELINE_KPI=1 npx vitest run tests/architecture/kpi-so-no-key-figure.test.ts`
 */
const VALOR_A_MAO = /\bfont-display\b[^"'`\n]*\btext-(?:lg|xl|2xl|kpi)\b[^"'`\n]*\btabular-nums\b/g;
const KEY_FIGURE = join("src", "components", "app", "KeyFigure.tsx");

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "kpi-so-no-key-figure.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_KPI",
  conta: (arquivo) => arquivo.ocorrencias(VALOR_A_MAO),
  consome: (arquivo) => arquivo.eFonteDeTela && arquivo.caminho !== KEY_FIGURE,
});

describe("número-síntese só pelo KeyFigure", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua reconhece o valor à mão e ignora o título de página", () => {
    expect(
      'className="font-display text-2xl font-semibold tabular-nums"'.match(VALOR_A_MAO),
    ).toHaveLength(1);
    expect('className="font-display text-2xl font-semibold"'.match(VALOR_A_MAO)).toBeNull();
  });
});
