import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Item 7 do lote de 2026-09-08, e a regra de reuso do dono: *"o que é usado
 * em dois lugares vira componente"*. O nome que a tela CORTA e devolve
 * inteiro no ponteiro já estava escrito à mão em quatro lugares, em duas
 * grafias diferentes:
 *
 *   - `truncate` + `title=` nativo — `team-shared.tsx` (e-mail do cartão,
 *     competência da maior distância, e-mail e time da tabela). O `title` do
 *     navegador não abre no toque nem por teclado ([F-02]).
 *   - `truncate` dentro de um `TooltipTrigger` montado na própria tela —
 *     `mentoring-shared.tsx`, que já tinha a grafia acessível, mas privada.
 *
 * Agora existe UM `TruncatedText`. A régua conta as duas grafias à mão, e o
 * piso declarado é ZERO: nenhuma tela monta a sua.
 *
 * Prova do vermelho no dia em que nasceu (fixture vazia, antes da migração):
 * 5 ocorrências em 2 arquivos —
 *   src/components/app/mentoring-shared.tsx: 1
 *   src/components/app/team-shared.tsx: 4
 *
 * Regravar: `ATUALIZAR_BASELINE_NOME_TRUNCADO=1 npx vitest run tests/architecture/nome-truncado-por-componente.test.ts`
 */
const TAG_NATIVA = /<[a-z][a-zA-Z0-9]*\s[^>]*>/g;
const TRUNCADO_NO_TOOLTIP = /<TooltipTrigger\b[^>]*>\s*<[a-z][a-zA-Z0-9]*\s[^>]*\btruncate\b/g;

/** O dono da régua não é contado por ela. */
const TRUNCATED_TEXT = join("src", "components", "app", "TruncatedText.tsx");

export function nomesTruncadosAMao(conteudo: string): number {
  let total = 0;
  for (const [tag] of conteudo.matchAll(TAG_NATIVA)) {
    if (/\btruncate\b/.test(tag) && /\stitle=/.test(tag)) total += 1;
  }
  return total + (conteudo.match(TRUNCADO_NO_TOOLTIP) ?? []).length;
}

const catraca = new Catraca({
  fixture: join(
    raizDoFrontend,
    "tests",
    "architecture",
    "nome-truncado-por-componente.fixture.json",
  ),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_NOME_TRUNCADO",
  conta: (arquivo) => nomesTruncadosAMao(arquivo.conteudo),
  consome: (arquivo) => arquivo.eFonteDeTela && arquivo.caminho !== TRUNCATED_TEXT,
});

describe("o nome truncado com o texto inteiro mora num componente só", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua conta as duas grafias à mão", () => {
    expect(
      nomesTruncadosAMao('<p className="truncate text-xs" title={a.email}>{a.email}</p>'),
    ).toBe(1);
    expect(
      nomesTruncadosAMao(
        '<TooltipTrigger asChild><span tabIndex={0} className="min-w-0 flex-1 truncate">{name}</span></TooltipTrigger>',
      ),
    ).toBe(1);
  });

  it("a régua não conta o que corta sem devolver, nem o que devolve sem cortar", () => {
    expect(nomesTruncadosAMao('<span className="block truncate">{nome}</span>')).toBe(0);
    expect(nomesTruncadosAMao('<button title="Fechar" aria-label="Fechar" />')).toBe(0);
    expect(nomesTruncadosAMao('<TruncatedText text={a.email} className="block text-xs" />')).toBe(
      0,
    );
  });
});
