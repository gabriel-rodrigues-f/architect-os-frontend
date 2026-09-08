/**
 * ADR-0096 — o caminho velho da ficha virou `/professionals/<id>/…`.
 *
 * O backend NÃO ganhou rota-apelido: o caminho velho da API deixou de existir
 * no mesmo movimento, e a quebra de contrato é assumida (backend e frontend
 * sobem juntos). Aqui é diferente: a barra de endereço é do usuário. Quem
 * salvou o link da ficha de alguém, mandou por mensagem ou deixou aberto numa
 * aba não participou da decisão de renomear — e um 404 seria a aplicação
 * cobrando dele uma mudança nossa.
 *
 * Então o caminho velho não some, ele APONTA: só o primeiro segmento é
 * reescrito, o resto do endereço (id, aba, query, âncora) viaja intacto, e a
 * troca é `replace` para o link velho não ficar no histórico do navegador.
 *
 * É gentileza com prazo, não contrato: some quando os links velhos morrerem.
 */
export class LegacyProfessionalLink {
  /** O primeiro segmento que saiu de cena. É ENDEREÇO, não vocabulário: a
   *  catraca de `vocabulario-positivo` varre a palavra portuguesa em `src/`,
   *  e o inglês continua legítimo em literal de rota. */
  private static readonly SEGMENTO_ANTIGO = "/architects";

  private static readonly SEGMENTO_NOVO = "/professionals";

  /**
   * O endereço novo equivalente, ou `null` quando o caminho não é um link
   * velho. A comparação é por SEGMENTO (o caminho exato, ou ele seguido de
   * `/`), nunca por prefixo de texto: um caminho que apenas COMEÇA com as
   * mesmas letras não é link velho e não pode ser reescrito.
   */
  static redirectFor(pathname: string): string | null {
    const antigo = LegacyProfessionalLink.SEGMENTO_ANTIGO;
    if (pathname !== antigo && !pathname.startsWith(`${antigo}/`)) return null;
    return LegacyProfessionalLink.SEGMENTO_NOVO + pathname.slice(antigo.length);
  }
}
