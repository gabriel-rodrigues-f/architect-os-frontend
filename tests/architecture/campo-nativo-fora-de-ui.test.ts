import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [F-01]: 37 campos nativos estilizados à mão —
 * `<select>`, `<input>` e `<textarea>` com `border-input` na classe — em 18
 * arquivos, com três alturas diferentes e 21 selects sem anel de foco. A
 * primitiva `Select` (e o `Input`) agora existem em `components/ui/`; a
 * troca é por rota (PR 10) e esta catraca garante que o número só desce.
 * Prova do vermelho no dia em que nasceu: 38 ocorrências em 14 arquivos com
 * a fixture vazia (o inventário da auditoria contou 37; a régua acha um a
 * mais em `RoleSelect.tsx`, o wrapper de um select — conta, porque também
 * está fora de `components/ui/`).
 *
 * Regravar: `ATUALIZAR_BASELINE_CAMPO_NATIVO=1 npx vitest run tests/architecture/campo-nativo-fora-de-ui.test.ts`
 */
const CAMPO_NATIVO_A_MAO = /<(?:select|input|textarea)\b[^>]*?border-input[^>]*>/gs;

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "campo-nativo-fora-de-ui.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_CAMPO_NATIVO",
  conta: (arquivo) => arquivo.ocorrencias(CAMPO_NATIVO_A_MAO),
  consome: (arquivo) => arquivo.eFonteDeTela && !arquivo.chave.startsWith("src/components/ui/"),
});

describe("campo nativo estilizado à mão fora de components/ui só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua reconhece o campo nativo com a classe do Input, e ignora a primitiva", () => {
    expect(
      `<select id="x" className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm">`.match(
        CAMPO_NATIVO_A_MAO,
      ),
    ).toHaveLength(1);
    expect(
      `<input\n  type="number"\n  className={cn("border border-input", x)}\n/>`.match(
        CAMPO_NATIVO_A_MAO,
      ),
    ).toHaveLength(1);
    expect(`<Input className="border-input" /> <Select />`.match(CAMPO_NATIVO_A_MAO)).toBeNull();
  });
});
