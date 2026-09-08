import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ArquivoFonte, Catraca, Varredura, raizDoFrontend } from "../helpers/catraca";

/**
 * NENHUM SELETOR APARECE VAZIO — a catraca que faltava.
 *
 * Dono (2026-09-08), literal: *"um bug que eu já havia reclamado no passado:
 * não devemos ter comboboxes vazios. Quando ainda não houver ciclos
 * cadastrados, mostrar 'Não há ciclos cadastrados' + 'Cadastrar primeiro
 * ciclo' como hiperlink para a tela de cadastro"*.
 *
 * O pedido é REINCIDENTE: já era o item 1 da onda de 2026-09-02, foi dado
 * por entregue, e voltou — a onda cobriu o Painel e Times e o seletor do
 * CABEÇALHO nunca foi coberto. Voltou porque não havia catraca. Esta é ela.
 *
 * O que a régua conta, por arquivo de tela:
 *
 *  1. SELETOR DA CASA (`SingleSelectFilter`/`MultiSelectFilter`) cuja lista
 *     NÃO é um array literal escrito ali — ou seja, vem de dados e pode
 *     nascer vazia — e que não declara `empty`. O componente já garante que
 *     nenhum deles desenha um campo em branco (cai na frase da casa), mas
 *     "Não há ciclos cadastrados" e o hiperlink de cadastro são do domínio:
 *     quem sabe a frase é a tela, e declarar é a régua. Piso: ZERO.
 *
 *  2. `<select>` NATIVO alimentado por `.map(` — o formato que ainda não
 *     passou pelo componente da casa e por isso ainda pode desenhar uma
 *     caixinha vazia. Estes descem junto com `campo-nativo-fora-de-ui`, à
 *     medida que as telas migram para o seletor da casa.
 *
 * Prova do vermelho no dia em que nasceu (a régua rodada contra o `a8a3a55`,
 * com a fixture vazia): 36 ocorrências em 21 arquivos, das quais 17 eram
 * seletores da CASA sem frase de vazio — entre elas o `AppShell.tsx`, o do
 * pedido do dono. Os 17 foram a zero nesta fatia; o que resta na baseline é
 * `<select>` nativo, e desce com a migração para o seletor da casa.
 *
 * Regravar: `ATUALIZAR_BASELINE_SELETOR_VAZIO=1 npx vitest run tests/architecture/nenhum-seletor-sem-vazio.test.ts`
 */
/**
 * A TERCEIRA FORMA, que esta régua deixou passar (dono, 2026-09-08): a
 * COMBOBOX PRÓPRIA. O filtro de capacidades da Avaliação de Desempenho não é
 * o seletor da casa nem um `<select>` nativo — é um componente que monta o
 * próprio gatilho (`FilterTriggerButton`) e o próprio painel. Com o catálogo
 * vazio ele abria um `Popover` de nada e dizia "Selecione capacidades".
 *
 * A régua nova: quem desenha um gatilho de filtro sobre uma lista de DADOS
 * delega o vazio ao `EmptySelectionField` — o mesmo desenho da combobox de
 * pessoa. Piso: ZERO. Prova do vermelho contra o `e13e5f3`: 1 ocorrência,
 * `src/components/app/CapabilityCombobox.tsx`, exatamente a do pedido.
 */
const GATILHO_DE_FILTRO = /<FilterTriggerButton\b/;
const DELEGA_O_VAZIO = /\bEmptySelectionField\b/;

const SELETOR_DA_CASA = /<(?:Single|Multi)SelectFilter\b[\s\S]*?\/>/g;
const SELECT_NATIVO = /<select\b[\s\S]*?<\/select>/g;
/** Lista escrita ali mesmo: `options={[ ... ]}` nunca chega vazia por dados. */
const LISTA_LITERAL = /options=\{\s*\[/;
const DECLARA_VAZIO = /\bempty=\{/;
const LISTA_DE_DADOS = /\.map\(/;

/** Os donos da régua não são contados por ela. */
const DONOS_DA_REGUA = [
  join("src", "components", "app", "EmptySelection.tsx"),
  join("src", "components", "app", "SingleSelectFilter.tsx"),
  join("src", "components", "app", "MultiSelectFilter.tsx"),
  join("src", "components", "app", "FilterTriggerButton.tsx"),
];

/** Seletor da CASA sem frase de vazio declarada — o piso deste é ZERO. */
export function seletoresDaCasaSemVazio(conteudo: string): number {
  let total = 0;
  for (const [seletor] of conteudo.matchAll(SELETOR_DA_CASA)) {
    if (LISTA_LITERAL.test(seletor)) continue;
    if (DECLARA_VAZIO.test(seletor)) continue;
    total += 1;
  }
  return total;
}

/** `<select>` nativo alimentado por dados — ainda pode desenhar caixinha vazia. */
export function selectsNativosDeDados(conteudo: string): number {
  let total = 0;
  for (const [seletor] of conteudo.matchAll(SELECT_NATIVO)) {
    if (LISTA_DE_DADOS.test(seletor)) total += 1;
  }
  return total;
}

/** Combobox própria sobre lista de dados que não delega o vazio — piso ZERO. */
export function comboboxPropriaSemVazio(conteudo: string): number {
  if (!GATILHO_DE_FILTRO.test(conteudo)) return 0;
  if (!LISTA_DE_DADOS.test(conteudo)) return 0;
  return DELEGA_O_VAZIO.test(conteudo) ? 0 : 1;
}

export function seletoresSemVazio(conteudo: string): number {
  return (
    seletoresDaCasaSemVazio(conteudo) +
    selectsNativosDeDados(conteudo) +
    comboboxPropriaSemVazio(conteudo)
  );
}

const eTelaDaCasa = (arquivo: ArquivoFonte): boolean =>
  arquivo.eFonteDeTela &&
  !arquivo.chave.startsWith("src/components/ui/") &&
  !DONOS_DA_REGUA.includes(arquivo.caminho);

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "nenhum-seletor-sem-vazio.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_SELETOR_VAZIO",
  conta: (arquivo) => seletoresSemVazio(arquivo.conteudo),
  consome: eTelaDaCasa,
});

describe("nenhum seletor da aplicação aparece vazio", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("nenhum seletor da CASA fica sem frase de vazio — o piso deles é ZERO", () => {
    const pendentes = new Varredura().contagem(
      (arquivo) => seletoresDaCasaSemVazio(arquivo.conteudo),
      eTelaDaCasa,
    );
    expect(pendentes).toEqual({});
  });

  it("nenhuma combobox PRÓPRIA fica sem o vazio da casa — o piso dela é ZERO", () => {
    const pendentes = new Varredura().contagem(
      (arquivo) => comboboxPropriaSemVazio(arquivo.conteudo),
      eTelaDaCasa,
    );
    expect(pendentes).toEqual({});
  });

  it("a régua reconhece a combobox própria que não delega o vazio", () => {
    const propria = `
      export function CapabilityCombobox({ capabilities }) {
        return (
          <Popover>
            <FilterTriggerButton>{resumo}</FilterTriggerButton>
            {capabilities.map((c) => (<CommandItem key={c.id} />))}
          </Popover>
        );
      }`;
    expect(comboboxPropriaSemVazio(propria)).toBe(1);
    expect(
      comboboxPropriaSemVazio(
        `${propria}\nif (capabilities.length === 0) return <EmptySelectionField empty={vazio} />;`,
      ),
    ).toBe(0);
  });

  it("a régua reconhece o seletor da casa sem `empty`, e poupa quem já declara", () => {
    expect(
      seletoresSemVazio(
        `<SingleSelectFilter id="cycle" options={cycles.map((c) => ({ value: c.id }))} />`,
      ),
    ).toBe(1);
    expect(
      seletoresSemVazio(
        `<SingleSelectFilter id="cycle" options={cycles.map((c) => ({ value: c.id }))} empty={{ message: t("x") }} />`,
      ),
    ).toBe(0);
    expect(seletoresSemVazio(`<MultiSelectFilter id="k" options={kinds.map((k) => k)} />`)).toBe(1);
  });

  it("lista escrita na própria tela não conta — ela nunca chega vazia por dados", () => {
    expect(
      seletoresSemVazio(
        `<SingleSelectFilter id="f" options={[{ value: "all", label: "Todos" }]} />`,
      ),
    ).toBe(0);
  });

  it("o `<select>` nativo alimentado por dados conta; o de opções fixas, não", () => {
    expect(
      seletoresSemVazio(`<select id="t"><option value="">—</option>{times.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}</select>`),
    ).toBe(1);
    expect(
      seletoresSemVazio(
        `<select id="t"><option value="a">A</option><option value="b">B</option></select>`,
      ),
    ).toBe(0);
  });
});
