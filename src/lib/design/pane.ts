/**
 * A altura de uma FIGURA de gráfico. O número existe uma vez: a figura o usa
 * para desenhar e o token `--pane-figure-h` o repete para a caixa que a
 * hospeda — e a régua cobra que os dois sejam o mesmo. Enquanto a caixa pedia
 * "3 itens" do ritmo genérico, ela media 276 para uma figura de 320, e o radar
 * rolava 44px dentro de si.
 */
export const CHART_FIGURE_HEIGHT_PX = 320;

/**
 * O RITMO de um bloco rolável: quanto ALTO é um item dele. Existe para que a
 * altura da caixa seja pedida em ITENS ("três itens", "duas linhas") e não em
 * pixels espalhados pelas telas — o número mora uma vez, no token da folha de
 * estilo, e a tela só diz quantos cabem.
 *
 * Havia UM ritmo de item — `--pane-item-h`, 92px — servindo a três listas e a
 * uma figura, e o número nunca foi medido. Medido no navegador com o CSS
 * compilado (1440×900), o PASSO de cada uma é outro: 110,89 no cartão de
 * capacidade do Catálogo, 126 a 166 no item de prioridade, 160 a 176 no
 * cartão de distância, e o radar não é lista nenhuma — é uma figura de 320.
 * Com 92, `items(3)` do Catálogo mostrava DOIS CARTÕES E MEIO: o dono pedia
 * três e via 2,5.
 *
 * Então o ritmo é POR TIPO DE ITEM. Um número médio para quatro conteúdos
 * diferentes seria o mesmo chute com outro valor.
 */
export class PaneRhythm {
  private constructor(
    readonly name: string,
    readonly token: string,
  ) {}

  /** Linha de tabela da casa: `py-2` sobre o corpo de texto padrão. */
  static readonly ROW = new PaneRhythm("row", "--pane-row-h");

  /** Cartão de capacidade empilhado — o item do Catálogo de Competências. */
  static readonly CARD = new PaneRhythm("card", "--pane-card-h");

  /** Item da lista de prioridades de desenvolvimento — altura variável. */
  static readonly PRIORITY = new PaneRhythm("priority", "--pane-priority-h");

  /** Cartão de competência com a distância (`CompetencyGapCard`). */
  static readonly DISTANCE_CARD = new PaneRhythm("distance-card", "--pane-distance-card-h");

  /**
   * A FIGURA de um gráfico. Não é item de lista: a figura declara a própria
   * altura, e a caixa que a hospeda pede UMA. Estava vestida de `items(3)` do
   * ritmo genérico — 276px para uma figura de 320 —, e por isso o radar rolava
   * 44px dentro da própria caixa sem ter o que rolar.
   */
  static readonly FIGURE = new PaneRhythm("figure", "--pane-figure-h");

  static readonly ALL: readonly PaneRhythm[] = [
    PaneRhythm.ROW,
    PaneRhythm.CARD,
    PaneRhythm.PRIORITY,
    PaneRhythm.DISTANCE_CARD,
    PaneRhythm.FIGURE,
  ];
}

/**
 * A CAIXA QUE OCUPA O RESTO DA PÁGINA — dono (2026-09-10): *"Em Contas e
 * Acessos, ainda preciso rolar para baixo para ver a lista. Quero que comporte
 * o grupo de Contas cadastradas dentro da tela."*
 *
 * A caixa já rolava em si; errada era a CONTA. `restOfPage()` valia a janela
 * menos o cabeçalho do shell menos um RECUO DE PÁGINA, e esse terceiro termo
 * — 16rem, um token só para ele — era um CHUTE: "a faixa de título e filtros de uma página
 * típica". Não existe página típica. Em Contas e Acessos, acima da caixa
 * moram título, subtítulo, cabeçalho do cartão, o filtro de Time DENTRO do
 * cartão e o cabeçalho da tabela; a caixa começava mais embaixo do que a
 * conta supunha e vazava 25px abaixo da dobra em 1440×900. Somar mais recuo
 * consertaria esta tela e quebraria as outras seis: um número para sete topos
 * diferentes.
 *
 * Então a conta some. A caixa deixa de ter TETO e passa a ser **o filho que
 * ocupa o que sobra** de uma coluna de altura cheia: a casca para de crescer
 * com o conteúdo, o quadro da página vira coluna, e a caixa é o único filho
 * que estica e encolhe (`flex-1` com `min-h-0`). A altura passa a ser MEDIDA
 * pelo navegador — nenhum termo da conta é adivinhado, nem o cabeçalho: quem
 * mede é a própria coluna, não o token.
 *
 * A cadeia entre o quadro e a caixa é vestida por regra genérica
 * (`*:has(marcador)`), e não tela por tela: por isso as sete telas se
 * consertam de uma vez, e uma oitava não precisa saber de nada.
 *
 * Em tela estreita NADA disto vale — a página já rola, e caixa que rola
 * dentro de página que rola é pior que o defeito original. Por isso cada
 * classe carrega o `xl:` COLADO no literal: o Tailwind v4 só compila a classe
 * que enxerga inteira no fonte.
 */
export class PageFillingPane {
  /** O atributo com que a caixa se anuncia aos ancestrais. */
  static readonly MARKER = "data-pane-fills-page";

  /**
   * O degrau de FOLGA abaixo do grupo, no pé do quadro (dono, 2026-09-10:
   * *"quero ver uma folga abaixo deste grupo quando estiver em zoom de
   * 100%"*). Respiro é espaçamento, e espaçamento é da GRADE — entra como
   * degrau da grade de 4px no quadro da página, nunca como mais um termo
   * dentro da conta da caixa. Misturar os dois foi o que produziu o chute.
   */
  static readonly SLACK_STEP = 12;

  /**
   * A caixa: sem teto, ela é o filho que estica e encolhe. O PISO existe para
   * o caso extremo — janela tão baixa que, depois do título e dos filtros, não
   * sobra nada: sem ele a caixa ia a zero e a lista sumia inteira. E o piso é
   * medido em LINHAS, no ritmo do conteúdo (`--pane-row-h`), como `items(n)`
   * — nunca em fatia de janela, que é o que produziu o chute. Ele também faz
   * o papel do `min-h-0`: qualquer `min-height` explícito solta o item do
   * `auto` e o deixa encolher abaixo do conteúdo.
   */
  static readonly paneClass = "xl:min-h-[calc(3*var(--pane-row-h))] xl:flex-1";

  /**
   * A CASCA para de crescer com o conteúdo — sem isto a coluna não tem altura
   * definida e não há "resto" para ninguém ocupar. É `max-h`, não `h`: se o
   * que está acima da caixa não couber, o conteúdo transborda e o DOCUMENTO
   * volta a rolar (o defeito antigo), em vez de ser cortado.
   */
  static readonly shellClass = "xl:has-[[data-pane-fills-page]]:max-h-dvh";

  /**
   * O QUADRO da página vira coluna, e toda a cadeia entre ele e a caixa vira
   * coluna junto (`*:has(...)` pega exatamente os ancestrais do marcador).
   * O `pb-12` é a folga do dono, medida da grade.
   */
  static readonly frameClass =
    "xl:has-[[data-pane-fills-page]]:flex xl:has-[[data-pane-fills-page]]:min-h-0 " +
    "xl:has-[[data-pane-fills-page]]:flex-col xl:has-[[data-pane-fills-page]]:pb-12 " +
    "xl:[&_*:has([data-pane-fills-page])]:flex xl:[&_*:has([data-pane-fills-page])]:min-h-0 " +
    "xl:[&_*:has([data-pane-fills-page])]:flex-1 xl:[&_*:has([data-pane-fills-page])]:flex-col";
}

/** Como a caixa se veste para ter a altura pedida — classe, variável e marcador. */
export interface PaneFitting {
  readonly className: string;
  readonly style: Record<string, string> | undefined;
  readonly attributes: Record<string, string>;
}

/**
 * A ALTURA MÁXIMA de um bloco rolável. Duas medidas, e nenhuma delas é um
 * pixel solto:
 *
 * - {@link PaneHeight.restOfPage} — o que sobra abaixo do topo da própria
 *   caixa. Não é conta: é o {@link PageFillingPane}, e o navegador mede.
 * - {@link PaneHeight.items} — tantos itens quantos o dono pediu, no ritmo do
 *   conteúdo. Aqui a medida é de CONTEÚDO e quem a define é o dono ("3
 *   itens", "no máximo 2 times"); `withColumnHeader` acrescenta a linha do
 *   cabeçalho de colunas, que fica presa e não conta como item lido.
 */
export abstract class PaneHeight {
  /** A variável que a caixa com teto lê — o valor entra por `style`, não por classe montada. */
  static readonly TOKEN = "--pane-max-h";

  abstract get fitting(): PaneFitting;

  static restOfPage(): PaneHeight {
    return new FillsPagePaneHeight();
  }

  static items(count: number, rhythm: PaneRhythm = PaneRhythm.ROW): ItemsPaneHeight {
    return new ItemsPaneHeight(count, rhythm, false);
  }

  /** A mesma medida em itens, mais a linha presa do cabeçalho de colunas. */
  static rowsWithColumnHeader(count: number): ItemsPaneHeight {
    return new ItemsPaneHeight(count, PaneRhythm.ROW, true);
  }
}

class FillsPagePaneHeight extends PaneHeight {
  get fitting(): PaneFitting {
    return {
      className: PageFillingPane.paneClass,
      style: undefined,
      attributes: { [PageFillingPane.MARKER]: "" },
    };
  }
}

export class ItemsPaneHeight extends PaneHeight {
  constructor(
    private readonly count: number,
    private readonly rhythm: PaneRhythm,
    private readonly columnHeader: boolean,
  ) {
    super();
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(`Altura em itens pede um inteiro positivo, recebeu ${String(count)}.`);
    }
  }

  get css(): string {
    const lines = this.count + (this.columnHeader ? 1 : 0);
    return `calc(${String(lines)} * var(${this.rhythm.token}))`;
  }

  get fitting(): PaneFitting {
    return {
      className: ScrollPaneStyle.capClass,
      style: { [PaneHeight.TOKEN]: this.css },
      attributes: {},
    };
  }
}

/**
 * As classes que montam a caixa de rolagem — o mesmo aprendizado da coluna de
 * apoio do PDI (`ShellHeader.sideRailClass`), agora generalizado para QUALQUER
 * bloco cujo título precisa continuar visível.
 *
 * Toda classe carrega o variante `xl:` COLADO no literal, por dois motivos:
 * em tela estreita a página já rola, e caixa que rola dentro de página que
 * rola é pior que o defeito original; e o Tailwind v4 só compila a classe que
 * enxerga inteira no fonte — `xl:` montado por template morre.
 */
export class ScrollPaneStyle {
  /** A rolagem vertical — comum às duas alturas. */
  static readonly scrollClass = "xl:overflow-y-auto";

  /** O TETO por variável, para a altura pedida em itens (o valor vem por `style`). */
  static readonly capClass = "xl:max-h-(--pane-max-h)";

  /** Alcance por teclado e a barra da casa — valem em qualquer largura. */
  static readonly reachClass = "scroll-visible rounded-lg focus-visible:focus-ring";

  /**
   * Tabela larga: o MESMO elemento rola nos dois eixos. Separar em duas caixas
   * quebraria o cabeçalho preso — ele gruda no topo de quem rola, e quem rola
   * na vertical tem de ser o mesmo que rola na horizontal.
   */
  static readonly horizontalClass = "scroll-visible overflow-x-auto";

  /**
   * Onde há tabela, o cabeçalho de coluna fica preso no topo da caixa: sem
   * isso a pessoa perde a legenda das colunas no meio da lista. O fundo é o do
   * cartão porque o cabeçalho passa POR CIMA das linhas que rolam.
   */
  static readonly pinnedColumnHeaderClass =
    "xl:[&_thead_th]:sticky xl:[&_thead_th]:top-0 xl:[&_thead_th]:z-10 xl:[&_thead_th]:bg-card";
}
