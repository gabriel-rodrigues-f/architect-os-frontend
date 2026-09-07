import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [B-01]: 28 links à mão com `hover:underline`
 * enquanto `variant="link"` tinha zero usos. O sublinhado no ponteiro é o
 * sinal do link e mora em UM lugar: a variante `link` do `Button` (e o
 * `TextLink`, quando nascer, para `<a>`/`<Link>`). A troca dos 28 é por
 * rota (PR 10); esta catraca garante que o número só desce. Prova do
 * vermelho no dia: 28 ocorrências em 14 arquivos com a fixture vazia.
 *
 * Regravar: `ATUALIZAR_BASELINE_SUBLINHADO=1 npx vitest run tests/architecture/sublinhado-so-no-link.test.ts`
 */
const SUBLINHADO_NO_PONTEIRO = /\bhover:underline\b/g;
const DONOS_DO_SUBLINHADO = ["src/components/ui/button.tsx", "src/components/app/TextLink.tsx"];

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "sublinhado-so-no-link.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_SUBLINHADO",
  conta: (arquivo) => arquivo.ocorrencias(SUBLINHADO_NO_PONTEIRO),
  consome: (arquivo) => arquivo.eFonteDeTela && !DONOS_DO_SUBLINHADO.includes(arquivo.chave),
});

describe("hover:underline só na variante link", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua ignora `underline-offset` e o sublinhado fixo", () => {
    expect("underline-offset-4 underline hover:underline".match(SUBLINHADO_NO_PONTEIRO)).toEqual([
      "hover:underline",
    ]);
  });
});
