import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [I-01] (decisão do dono, UX-b): emoji como
 * ícone semântico renderiza com a fonte do sistema, ignora tema e
 * `currentColor`, e o leitor de tela anuncia "chart increasing". Os sinais
 * dos blocos de IA agora são ícones lucide, mapeados pela `AdviceSemiotics`.
 *
 * A régua conta pictogramas em `src/` fora de `locales/`; o número só desce.
 * Prova do vermelho no dia em que nasceu: 24 ocorrências em 3 arquivos com a
 * fixture vazia (18 na `AdviceSemiotics`, 5 em `ai-shared`, o `✓` de
 * `assessments-shared`).
 *
 * Regravar: `ATUALIZAR_BASELINE_EMOJI=1 npx vitest run tests/architecture/emoji-fora-de-locales.test.ts`
 */
const PICTOGRAMA = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const LOCALES = `${join("src", "locales")}${sep}`;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "emoji-fora-de-locales.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_EMOJI",
  conta: (arquivo) => arquivo.ocorrencias(PICTOGRAMA),
  consome: (arquivo) => arquivo.eFonteDeTela && !arquivo.caminho.startsWith(LOCALES),
});

describe("emoji como ícone só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua reconhece o pictograma e o símbolo tipográfico, e ignora letras acentuadas", () => {
    expect("⚠️ 🎯 ✓".match(PICTOGRAMA)).toHaveLength(3);
    expect("avaliação — nível".match(PICTOGRAMA)).toBeNull();
  });
});
