import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { ArquivoFonte, Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Dono (2026-09-08), literal: *"o botão 'Nova trilha' em Trilhas de
 * Aprendizagem tem a mesma identidade visual de 'Ciclos de Avaliação > Novo
 * ciclo' e 'Catálogo de Competências > Nova capacidade'. Mas 'Estrutura de
 * Times > Criar time' e 'Contas e Acessos > Cadastrar pessoas' não seguem o
 * mesmo padrão."*
 *
 * A causa era estrutural: cada tela escrevia o PRÓPRIO `<Button>` de criação,
 * e a régua morava na cabeça de quem escrevia — `size="sm"` em Times e
 * Contas, tamanho padrão em Trilhas, Ciclos e Catálogo; ícone em nenhum.
 * Agora a ação de criar nasce de UM componente: `PageAction` (a principal do
 * cabeçalho da página), `PageActions` (o grupo) e `SectionAction` (a ação de
 * cabeçalho de seção).
 *
 * A régua conta o `<Button>` ESCRITO À MÃO com rótulo de criação em
 * `src/routes/` e `src/components/app/`. O rótulo de criação é a chave i18n
 * (`*.new*`, `*.create.action`, `*.admit.action`, `*.allocate`) ou a palavra
 * solta na tela ("Nova", "Novo", "Criar", "Cadastrar"). O rodapé do diálogo
 * (`DialogFooter`) sai da conta ANTES: ali o botão CONFIRMA o formulário
 * ("Criar trilha", "Cadastrar pessoa" depois de preencher) — é o fecho de um
 * diálogo, não a ação de cabeçalho que o abre.
 *
 * Prova do vermelho no dia em que nasceu (fixture vazia, antes da migração):
 * 10 ocorrências em 6 arquivos —
 *   src/components/app/mentoring-shared.tsx: 1
 *   src/routes/competency-matrix.tsx: 3
 *   src/routes/cycles.tsx: 2
 *   src/routes/learning-paths.tsx: 1
 *   src/routes/teams.tsx: 2
 *   src/routes/users.tsx: 1
 * O piso declarado é ZERO: nenhuma tela escreve a ação de criação à mão.
 *
 * Regravar: `ATUALIZAR_BASELINE_ACAO_DE_PAGINA=1 npx vitest run tests/architecture/acao-de-pagina-por-componente.test.ts`
 */
const RODAPE_DE_DIALOGO = /<DialogFooter\b[\s\S]*?<\/DialogFooter>/g;
const BOTAO = /<Button\b[^>]*>([\s\S]*?)<\/Button>/g;
const CHAVE_DE_CRIACAO =
  /t\(\s*["'][A-Za-z0-9._]*(?:\.new(?![a-z])|\.create\.action|\.admit\.action|\.allocate\b)/;
const PALAVRA_DE_CRIACAO = /\b(?:Nova|Novo|Criar|Cadastrar)\b/;

/** O dono da régua não é contado por ela. */
const PAGE_ACTION = join("src", "components", "app", "PageAction.tsx");

const TELAS = [join("src", "routes"), join("src", "components", "app")];

export function acoesDeCriacaoAMao(conteudo: string): number {
  const semRodapeDeDialogo = conteudo.replace(RODAPE_DE_DIALOGO, "");
  let total = 0;
  for (const [, corpo] of semRodapeDeDialogo.matchAll(BOTAO)) {
    if (corpo === undefined) continue;
    if (CHAVE_DE_CRIACAO.test(corpo) || PALAVRA_DE_CRIACAO.test(corpo)) total += 1;
  }
  return total;
}

const eTelaDaCasa = (arquivo: ArquivoFonte): boolean =>
  arquivo.eFonteDeTela &&
  arquivo.caminho !== PAGE_ACTION &&
  TELAS.some((pasta) => arquivo.caminho.startsWith(`${pasta}${sep}`));

const catraca = new Catraca({
  fixture: join(
    raizDoFrontend,
    "tests",
    "architecture",
    "acao-de-pagina-por-componente.fixture.json",
  ),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_ACAO_DE_PAGINA",
  conta: (arquivo) => acoesDeCriacaoAMao(arquivo.conteudo),
  consome: eTelaDaCasa,
});

describe("a ação de criar nasce de um componente — nenhuma tela a escreve à mão", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua reconhece a chave e a palavra de criação, e não conta o que abre outra coisa", () => {
    expect(acoesDeCriacaoAMao('<Button onClick={abrir}>{t("path.new.placeholder")}</Button>')).toBe(
      1,
    );
    expect(acoesDeCriacaoAMao('<Button size="sm">{t("teams.create.action")}</Button>')).toBe(1);
    expect(acoesDeCriacaoAMao('<Button size="sm">{t("users.admit.action")}</Button>')).toBe(1);
    expect(acoesDeCriacaoAMao("<Button>Nova capacidade</Button>")).toBe(1);
    expect(acoesDeCriacaoAMao('<Button variant="secondary">{t("gap.export.csv")}</Button>')).toBe(
      0,
    );
    expect(acoesDeCriacaoAMao('<Button>{t("common.cancel")}</Button>')).toBe(0);
  });

  it("o botão que CONFIRMA o formulário no rodapé do diálogo não é ação de cabeçalho", () => {
    expect(
      acoesDeCriacaoAMao(
        '<DialogFooter><Button onClick={criar}>{t("path.new.action")}</Button></DialogFooter>',
      ),
    ).toBe(0);
  });

  it("a régua olha as telas e os componentes de tela, e poupa o dono da régua", () => {
    const fonte = (caminho: string) => new ArquivoFonte(caminho, "");
    expect(eTelaDaCasa(fonte(join("src", "routes", "teams.tsx")))).toBe(true);
    expect(eTelaDaCasa(fonte(join("src", "components", "app", "mentoring-shared.tsx")))).toBe(true);
    expect(eTelaDaCasa(fonte(PAGE_ACTION))).toBe(false);
    expect(eTelaDaCasa(fonte(join("src", "components", "ui", "button.tsx")))).toBe(false);
  });
});
