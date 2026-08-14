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

/** Data ISO em dd/mm/aaaa; `null` quando ausente ou inválida. */
export const formatDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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
