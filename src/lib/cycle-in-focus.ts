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
 * cabeçalho não mandava nunca. A regra é uma ordem, não um empate: o link diz
 * por onde a tela ENTRA, e o cabeçalho manda a partir da primeira troca.
 */
export class CycleInFocus {
  private constructor(
    private readonly pinned: string | undefined,
    private readonly activeWhenPinned: string,
  ) {}

  /**
   * O ciclo que o link pediu (ou nenhum), contra o ciclo ativo do instante em
   * que a tela abriu — é a comparação com esse instante que reconhece a troca.
   */
  static pinnedAt(pinned: string | undefined, activeWhenPinned: string): CycleInFocus {
    return new CycleInFocus(pinned, activeWhenPinned);
  }

  /** O ciclo a ler agora, dado o ciclo ativo da aplicação neste render. */
  under(activeCycleId: string): string {
    if (this.pinned === undefined) return activeCycleId;
    return this.pinnedStillHolds(activeCycleId) ? this.pinned : activeCycleId;
  }

  /** O link só continua valendo enquanto ninguém trocou o ciclo no cabeçalho. */
  private pinnedStillHolds(activeCycleId: string): boolean {
    return activeCycleId === this.activeWhenPinned;
  }
}
