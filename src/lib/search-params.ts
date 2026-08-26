/**
 * Utilitário de query string/roteamento — OO3-11b: morava em `text.ts`, cujo
 * próprio docstring declarava que o par não pertencia ali (não é formatação
 * de texto nem de data). As funções vieram movidas verbatim, com os
 * docstrings que explicam por que não usar `Route.useSearch()`.
 */

/**
 * Lê um parâmetro da query string na primeira montagem, sem depender de
 * `Route.useSearch()` — esse hook exige `RouterProvider` de verdade, que os
 * testes de componente isolado (`render(<Page />)` sem o app inteiro) não
 * montam. Ler direto de `window.location` funciona nos dois: no app real,
 * onde a URL já reflete `search` antes do primeiro render de uma rota nova
 * (TanStack Router atualiza a URL antes de montar o destino); e no teste,
 * onde simplesmente não há parâmetro nenhum e cai no `undefined`. `undefined`
 * no SSR (sem `window`) — a página cai no valor padrão do chamador. Ver
 * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC H.
 */
export const initialSearchParam = (name: string): string | undefined => {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get(name) ?? undefined;
};

/**
 * B-12 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1) — o par
 * complementar de `initialSearchParam`: sem isto, a página só honra o filtro
 * que já veio na URL no primeiro render, mas nunca escreve de volta quando o
 * filtro muda — dar F5 depois de trocar a seleção perdia tudo, e o link da
 * barra de endereço nunca refletia o que a tela mostra. `replaceState` (não
 * `pushState`) porque trocar um filtro é edição de estado da tela atual, não
 * navegação — não deveria empilhar uma entrada no histórico do botão
 * "Voltar" por marcação de caixinha. `undefined` remove a chave (URL limpa
 * quando o filtro está no valor padrão); string vazia mantém a chave
 * presente e vazia — distinção usada por quem chama para diferenciar
 * "parâmetro ausente" (cai no padrão) de "selecionado vazio de propósito".
 */
export const replaceSearchParam = (name: string, value: string | undefined): void => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (value === undefined) {
    params.delete(name);
  } else {
    params.set(name, value);
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
};
