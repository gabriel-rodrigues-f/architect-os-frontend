import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ArquivoFonte, Catraca, Varredura, raizDoFrontend } from "../helpers/catraca";

/**
 * TODO ESTADO VAZIO TEM DUAS LINHAS — e a primeira ninguém escreve à mão.
 *
 * Dono (2026-09-08, item 3): *"Linha 1 (branca, título), sempre no formato
 * `Nenhum {assunto} cadastrado` / `Nenhuma {assunto} cadastrada` … Linha 2
 * (cinza, apoio), SEMPRE presente, explicando a regra de negócio daquela
 * tela"*. A Calibração tinha uma linha só; o resto misturava quatro
 * vocabulários porque cada tela escrevia o título.
 *
 * A régua tem dois pisos e uma catraca:
 *
 *  1. `EmptyStateCallToAction` com `title=` — a tela escrevendo a linha 1 à
 *     mão. Piso: ZERO. Hoje o tipo nem aceita, e esta régua é o que impede
 *     que a propriedade volte por conveniência.
 *
 *  2. `EmptyStateCallToAction` sem `hint=` — estado vazio de uma linha só.
 *     Piso: ZERO. O tipo exige `hint`, e a régua guarda o dia em que alguém
 *     o marcar como opcional "só nesta tela".
 *
 *  3. `EmptyState` cru com `title=` e sem `hint=` — o estado vazio de uma
 *     linha que NÃO é "nada cadastrado" (filtro sem resultado, escopo vazio).
 *     Esse desce por catraca, à medida que cada um ganha a sua segunda linha.
 *
 * Prova do vermelho no dia em que nasceu, rodada contra o `e13e5f3`: a régua
 * 1 acusava 11 blocos em 11 telas — TODAS escreviam a linha 1 à mão; a régua
 * 3 acusava 4 estados vazios de uma linha, entre eles o `teamRules.noTeam`
 * ("Nenhum time disponível para configurar.") que o dono apontou no item 11.
 * A régua 2 nasceu verde de propósito: a linha única do bloco de cadastro
 * (Calibração, item 12) já tinha sido corrigida na fatia anterior, e a régua
 * existe para que ela não volte.
 *
 * Regravar: `ATUALIZAR_BASELINE_VAZIO_DE_UMA_LINHA=1 npx vitest run tests/architecture/estado-vazio-tem-duas-linhas.test.ts`
 */
const BLOCO_DE_CADASTRO = /<EmptyStateCallToAction\b[\s\S]*?(?:\/>|>)/g;
const ESTADO_VAZIO_CRU = /<EmptyState(?![A-Za-z])\b[\s\S]*?(?:\/>|>)/g;
const ESCREVE_TITULO = /\btitle=/;
const ESCREVE_APOIO = /\bhint=/;

/** Os donos da régua não são contados por ela. */
const DONOS_DA_REGUA = [
  join("src", "components", "app", "EmptyStateCallToAction.tsx"),
  join("src", "components", "app", "ui-bits.tsx"),
];

/** A tela escrevendo a LINHA 1 à mão — o piso é ZERO. */
export function titulosEscritosAMao(conteudo: string): number {
  let total = 0;
  for (const [bloco] of conteudo.matchAll(BLOCO_DE_CADASTRO)) {
    if (ESCREVE_TITULO.test(bloco)) total += 1;
  }
  return total;
}

/** Bloco de cadastro sem a LINHA 2 — o piso é ZERO. */
export function blocosSemLinhaDeApoio(conteudo: string): number {
  let total = 0;
  for (const [bloco] of conteudo.matchAll(BLOCO_DE_CADASTRO)) {
    if (!ESCREVE_APOIO.test(bloco)) total += 1;
  }
  return total;
}

/** `EmptyState` cru com título e sem apoio — a catraca que ainda desce. */
export function vaziosDeUmaLinha(conteudo: string): number {
  let total = 0;
  for (const [bloco] of conteudo.matchAll(ESTADO_VAZIO_CRU)) {
    if (ESCREVE_TITULO.test(bloco) && !ESCREVE_APOIO.test(bloco)) total += 1;
  }
  return total;
}

const eTelaDaCasa = (arquivo: ArquivoFonte): boolean =>
  arquivo.eFonteDeTela &&
  !arquivo.chave.startsWith("src/components/ui/") &&
  !DONOS_DA_REGUA.includes(arquivo.caminho);

const catraca = new Catraca({
  fixture: join(
    raizDoFrontend,
    "tests",
    "architecture",
    "estado-vazio-tem-duas-linhas.fixture.json",
  ),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_VAZIO_DE_UMA_LINHA",
  conta: (arquivo) => vaziosDeUmaLinha(arquivo.conteudo),
  consome: eTelaDaCasa,
});

describe("todo estado vazio diz duas linhas", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("nenhuma tela escreve a linha 1 à mão — ela vem do assunto", () => {
    const pendentes = new Varredura().contagem(
      (arquivo) => titulosEscritosAMao(arquivo.conteudo),
      eTelaDaCasa,
    );
    expect(pendentes).toEqual({});
  });

  it("nenhum bloco de cadastro fica sem a linha 2", () => {
    const pendentes = new Varredura().contagem(
      (arquivo) => blocosSemLinhaDeApoio(arquivo.conteudo),
      eTelaDaCasa,
    );
    expect(pendentes).toEqual({});
  });

  it("a régua reconhece o título escrito à mão, e poupa quem só declara o assunto", () => {
    expect(
      titulosEscritosAMao(
        `<EmptyStateCallToAction title={t("asmt.empty.title")} hint={t("asmt.empty.hint")} />`,
      ),
    ).toBe(1);
    expect(
      titulosEscritosAMao(
        `<EmptyStateCallToAction subject={EmptySubject.CYCLE} hint={t("cycle.empty.hint")} />`,
      ),
    ).toBe(0);
  });

  it("a régua reconhece o estado vazio de uma linha só", () => {
    expect(blocosSemLinhaDeApoio(`<EmptyStateCallToAction subject={EmptySubject.CYCLE} />`)).toBe(
      1,
    );
    expect(
      blocosSemLinhaDeApoio(
        `<EmptyStateCallToAction subject={EmptySubject.CYCLE} hint={t("x")}>{acao}</EmptyStateCallToAction>`,
      ),
    ).toBe(0);
  });

  it("o `EmptyState` cru conta quando tem título e não tem apoio", () => {
    expect(vaziosDeUmaLinha(`<EmptyState title={t("compare.empty")} />`)).toBe(1);
    expect(vaziosDeUmaLinha(`<EmptyState title={t("gap.empty")} hint={t("gap.hint")} />`)).toBe(0);
    expect(vaziosDeUmaLinha(`<EmptyState hasFilters emptyMessage={t("team.noResults")} />`)).toBe(
      0,
    );
    // O bloco de cadastro não é contado duas vezes.
    expect(vaziosDeUmaLinha(`<EmptyStateCallToAction subject={x} hint={y} />`)).toBe(0);
  });
});
