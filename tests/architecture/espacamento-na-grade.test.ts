import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MICRO_STEPS } from "@/lib/design";
import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [S-01]: 13% das medidas de espaçamento fora da
 * grade de 4 px — `gap-2.5`, `p-5`, `mt-7`, `px-10` — enquanto o teste da
 * escala dizia que todo degrau era múltiplo de 4. A escala declarada não
 * restringia nada.
 *
 * A grade admite DOIS micro-degraus documentados em `scale.ts`
 * (`0.5` = 2 px e `1.5` = 6 px, para ícone e badge); tudo o mais fora do
 * múltiplo de 4 conta aqui e só desce. A normalização é por arquivo (PR 10).
 * Prova do vermelho no dia em que nasceu: 135 ocorrências em 38 arquivos com
 * a fixture vazia.
 *
 * Regravar: `ATUALIZAR_BASELINE_ESPACAMENTO=1 npx vitest run tests/architecture/espacamento-na-grade.test.ts`
 */
const FORA_DA_GRADE =
  /(?<![\w-])(?:[a-z-]+:)*-?(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|bottom|left|right|start|end|w|h|size|min-w|min-h|max-w|max-h|translate-x|translate-y)-(?:2\.5|3\.5|5|7|10)\b/g;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "espacamento-na-grade.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_ESPACAMENTO",
  conta: (arquivo) => arquivo.ocorrencias(FORA_DA_GRADE),
});

describe("espaçamento na grade de 4 px só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua pega o meio passo e ignora a grade e os micro-degraus admitidos", () => {
    expect("gap-2.5 p-5 md:mt-7 -mx-10 py-3.5".match(FORA_DA_GRADE)).toEqual([
      "gap-2.5",
      "p-5",
      "md:mt-7",
      "-mx-10",
      "py-3.5",
    ]);
    expect("gap-1.5 py-0.5 p-4 mt-6 w-12 h-16".match(FORA_DA_GRADE)).toBeNull();
  });

  it("os micro-degraus admitidos são exatamente 2 e 6 px", () => {
    expect(MICRO_STEPS).toEqual({ "0.5": 2, "1.5": 6 });
  });
});
