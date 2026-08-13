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
