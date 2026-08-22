/**
 * Formatação e normalização de texto, em um lugar só. Estava duplicado em cinco
 * telas — com variações sutis: uma versão do `slug` não removia o hífen das
 * pontas e gerava ids diferentes para o mesmo nome.
 */

/** Identificador estável a partir de um nome: minúsculas, sem acento, com hífens. */
export const slug = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Ordem alfabética em pt-BR: respeita acentos e ignora caixa. */
export const byName = <T extends { name: string }>(a: T, b: T): number =>
  a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

/** `AAAA-MM-DD` puro, sem hora — um calendário, não um instante. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Data ISO no formato do idioma ativo — `dd/mm/aaaa` em português, `mm/dd/aaaa`
 * em inglês. `null` quando ausente ou inválida.
 *
 * Formato fixo obrigaria quem lê em inglês a traduzir a data de cabeça, e é
 * justamente onde se troca dia por mês sem perceber. O locale é obrigatório, e
 * não um padrão silencioso — quem chama já está dentro de um componente com
 * `useI18n()`, então esquecer de passá-lo é um erro de digitação a mais, não
 * uma escolha razoável de fallback.
 *
 * Datas sem hora (`targetDate`, início/fim de ciclo) precisam do fuso travado
 * em UTC: `new Date("2026-01-01")` vira meia-noite UTC, e à noite no Brasil
 * (UTC-3) isso já é 31/12 no fuso local — o mesmo problema que `todayIso()`
 * evita ao montar a data à mão. Timestamp completo (com hora) já carrega o
 * instante certo e usa o fuso local, que é o que faz sentido para "salvo às".
 */
export const formatDate = (iso: string | null | undefined, locale: string): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(DATE_ONLY.test(iso) ? { timeZone: "UTC" } : {}),
  }).format(date);
};

/** Primeira palavra do nome — usada como sigla nas colunas dos mapas de calor. */
export const firstWord = (value: string): string => value.trim().split(/\s+/)[0] ?? value;

/**
 * Data de hoje em `AAAA-MM-DD`, no fuso local — o formato que os `<input
 * type="date">` e os campos de data do domínio usam.
 *
 * `toISOString()` não serve: converte para UTC e, à noite no Brasil, devolve o
 * dia seguinte.
 */
export const todayIso = (): string => {
  const now = new Date();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mes}-${dia}`;
};

/** Mesma ideia, deslocada em meses — usada como alvo padrão de um PDI. */
export const monthsFromTodayIso = (months: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};

/**
 * Mesma ideia de `todayIso`, deslocada pra trás em dias — usada pelos
 * presets de período (últimos 30/60/90 dias etc.). Achado na REVISAO-360-
 * FRONTEND (FE-360-001): a tela de Evolução tinha sua própria versão local
 * com `toISOString().slice(0, 10)`, que converte pra UTC e, à noite no
 * Brasil, já é o dia seguinte — o mesmo problema que `todayIso` existe pra
 * evitar.
 */
export const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};

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
