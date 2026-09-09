/**
 * O CICLO QUE A TELA ESTÁ LENDO — e de quem ela obedece quando as duas fontes
 * discordam.
 *
 * Duas coisas dizem "ciclo" para uma tela de pessoa: o `?cycleId=` do link que
 * a abriu (o "Ver" do histórico da ficha, HIST-001) e o seletor de ciclo do
 * cabeçalho, que é o filtro de ciclo da casa (direção do dono, 2026-09-08,
 * regras 11 e 16 — "as telas respondem sempre sobre o par time + pessoa +
 * ciclo selecionado").
 *
 * O bug de 2026-09-08 — *"quando mudo um ciclo, ainda vejo a mesma avaliação
 * de desempenho"* — nasceu de a tela ter congelado a resposta no instante do
 * mount (`useState(() => activeCycleId)`): o link ganhava para sempre, e o
 * cabeçalho não mandava nunca. A regra é uma ORDEM, não um empate: o link diz
 * por onde a tela ENTRA, e o cabeçalho manda A PARTIR DA PRIMEIRA TROCA.
 *
 * "A partir da primeira troca" é estado, não comparação: quem só compara o
 * ciclo ativo de agora com o do mount volta a obedecer ao link assim que o
 * cabeçalho passeia e retorna ao ciclo de entrada — e a tela mostra de novo a
 * avaliação de outro ciclo com o cabeçalho dizendo outra coisa, que é
 * exatamente o defeito relatado. Por isso são dois estados, e a passagem de um
 * para o outro é de mão única.
 */
export abstract class CycleInFocus {
  /**
   * A tela entrando: com o ciclo que o link pediu (ou nenhum), contra o ciclo
   * ativo do instante da entrada — é a comparação com esse instante que
   * reconhece a primeira troca.
   */
  static enteringWith(pinned: string | undefined, activeCycleId: string): CycleInFocus {
    return pinned === undefined ? HEADER_IN_FOCUS : new LinkInFocus(pinned, activeCycleId);
  }

  /** O ciclo a ler agora, dado o ciclo ativo da aplicação neste render. */
  abstract under(activeCycleId: string): string;

  /** Quem manda do próximo render em diante, visto o ciclo ativo deste. */
  abstract after(activeCycleId: string): CycleInFocus;
}

/** O cabeçalho manda: é o estado final, e dele não se sai. */
class HeaderInFocus extends CycleInFocus {
  under(activeCycleId: string): string {
    return activeCycleId;
  }

  after(_activeCycleId: string): CycleInFocus {
    return this;
  }
}

const HEADER_IN_FOCUS = new HeaderInFocus();

/** O link do histórico manda — até o cabeçalho se mexer pela primeira vez. */
class LinkInFocus extends CycleInFocus {
  constructor(
    private readonly pinned: string,
    private readonly activeWhenEntered: string,
  ) {
    super();
  }

  under(activeCycleId: string): string {
    return this.headerMoved(activeCycleId) ? activeCycleId : this.pinned;
  }

  after(activeCycleId: string): CycleInFocus {
    return this.headerMoved(activeCycleId) ? HEADER_IN_FOCUS : this;
  }

  private headerMoved(activeCycleId: string): boolean {
    return activeCycleId !== this.activeWhenEntered;
  }
}
