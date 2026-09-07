/**
 * Frases curtas, uma por linha (referência FIAP 2026-09-06, §2 item 9).
 *
 * Quebra um texto de ajuda ou de estado vazio em linhas, uma frase por linha,
 * para leitura em dois segundos. A quebra é no ponto final ou na exclamação
 * seguidos de maiúscula ou aspas — "mín. 3" e "p. ex." ficam inteiros, e a
 * pergunta cola na resposta ("Fila vazia? Nada pendente." é uma linha só: a
 * pergunta é o gancho da resposta, não uma frase em pé).
 */
export class SentenceLines {
  private static readonly BORDA = /(?<=[.!])\s+(?=["“(\p{Lu}])/u;

  constructor(private readonly text: string) {}

  get lines(): readonly string[] {
    const aparado = this.text.trim();
    return aparado === "" ? [] : aparado.split(SentenceLines.BORDA);
  }

  /** Bloco de no máximo `max` linhas — o que sobra se junta à última. */
  atMost(max: number): readonly string[] {
    const linhas = this.lines;
    if (linhas.length <= max) return linhas;
    return [...linhas.slice(0, max - 1), linhas.slice(max - 1).join(" ")];
  }
}
