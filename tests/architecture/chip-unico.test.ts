import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [F-03]: seis famílias de badge com raio, peso e
 * padding diferentes — três "chips" distintos na mesma tabela (nível,
 * distância, status de evidência). Agora existe UM `Chip`
 * (`components/app/Chip.tsx`) com tons e tamanhos; as famílias são fábricas
 * de tinta sobre ele.
 *
 * A régua conta a classe de chip escrita à mão: uma string de `className`
 * que junta o raio, o padding vertical de chip (`py-0.5`) e um tamanho de
 * rótulo. Fora do `Chip.tsx`, o número só desce. Prova do vermelho no dia em
 * que nasceu: 23 ocorrências em 13 arquivos com a fixture vazia.
 *
 * Regravar: `ATUALIZAR_BASELINE_CHIP=1 npx vitest run tests/architecture/chip-unico.test.ts`
 */
const STRING_DE_CLASSE = /["'`]([^"'`\n]*)["'`]/g;
const CHIP_A_MAO = /(?=.*\brounded-(?:full|md)\b)(?=.*\bpy-0\.5\b)(?=.*\btext-(?:xs|label|meta)\b)/;

const CHIP = join("src", "components", "app", "Chip.tsx");

export function chipsEscritosAMao(conteudo: string): number {
  let total = 0;
  for (const [, classe] of conteudo.matchAll(STRING_DE_CLASSE)) {
    if (classe !== undefined && CHIP_A_MAO.test(classe)) total += 1;
  }
  return total;
}

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "chip-unico.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_CHIP",
  conta: (arquivo) => chipsEscritosAMao(arquivo.conteudo),
  consome: (arquivo) => arquivo.eFonteDeTela && arquivo.caminho !== CHIP,
});

describe("um só Chip — a classe de chip escrita à mão só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua reconhece o chip à mão em qualquer ordem de classes e ignora o que não é chip", () => {
    expect(
      chipsEscritosAMao(
        'className="inline-flex rounded-md px-2 py-0.5 text-xs font-semibold" x="text-label py-0.5 rounded-full"',
      ),
    ).toBe(2);
    expect(
      chipsEscritosAMao(
        'className="rounded-md px-3 py-2 text-sm" y="rounded-full h-9 w-9 text-xs"',
      ),
    ).toBe(0);
  });
});
