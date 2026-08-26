/**
 * Formatação e normalização de texto, em um lugar só. Estava duplicado em cinco
 * telas — com variações sutis: uma versão do `slug` não removia o hífen das
 * pontas e gerava ids diferentes para o mesmo nome.
 *
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 68) — as funções puras deste arquivo viraram métodos de duas
 * classes por afinidade: `NameFormatter` (texto/nome — `slug`, `byName`,
 * `matchesSearch`, `truncateNames`) e `DateFormatter` (data —
 * `formatDate`, `todayIso`, `daysAgoIso`).
 * OO3-11b — `initialSearchParam`/`replaceSearchParam` (utilitário de query
 * string, não de formatação) moraram aqui até ganharem casa própria em
 * `lib/search-params.ts`.
 *
 * OO3-08 — os call sites migraram todos para as instâncias compartilhadas
 * (`defaultNameFormatter`/`defaultDateFormatter`) e as funções soltas de
 * compatibilidade foram removidas junto com os métodos sem uso em produção
 * (`firstWord`, `monthsFromTodayIso`).
 */

export class NameFormatter {
  /** Identificador estável a partir de um nome: minúsculas, sem acento, com hífens. */
  slug(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  /** Ordem alfabética em pt-BR: respeita acentos e ignora caixa. */
  byName = <T extends { name: string }>(a: T, b: T): number =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

  /**
   * R2-ESC-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — filtro local por nome,
   * usado pelos checklists de competências de Mentoria/Trilhas. `term` já
   * vem `trim()`ado e em minúsculas de quem chama — aqui só decide o
   * critério de match, para não repetir `.toLowerCase().includes(...)` em
   * cada tela.
   */
  matchesSearch(name: string, term: string): boolean {
    return term === "" || name.toLowerCase().includes(term);
  }

  /**
   * R2-ESC-05/R2-UX-09 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, regra C.2.9) —
   * lista de nomes concatenada sem teto ficava ilegível a partir de umas
   * poucas dezenas de pessoas (uma capacidade com referência distribuída
   * entre o time inteiro, por exemplo). Só a DIVISÃO fica aqui — o texto
   * "e mais N" é decisão de i18n de quem chama, nunca hardcoded numa lib
   * sem acesso a `t()`.
   */
  truncateNames(names: readonly string[], max = 5): { shown: string[]; remaining: number } {
    if (names.length <= max) return { shown: [...names], remaining: 0 };
    return { shown: names.slice(0, max), remaining: names.length - max };
  }
}

/** `AAAA-MM-DD` puro, sem hora — um calendário, não um instante. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class DateFormatter {
  /**
   * Data ISO no formato do idioma ativo — `dd/mm/aaaa` em português,
   * `mm/dd/aaaa` em inglês. `null` quando ausente ou inválida.
   *
   * Formato fixo obrigaria quem lê em inglês a traduzir a data de cabeça, e é
   * justamente onde se troca dia por mês sem perceber. O locale é
   * obrigatório, e não um padrão silencioso — quem chama já está dentro de
   * um componente com `useI18n()`, então esquecer de passá-lo é um erro de
   * digitação a mais, não uma escolha razoável de fallback.
   *
   * Datas sem hora (`targetDate`, início/fim de ciclo) precisam do fuso
   * travado em UTC: `new Date("2026-01-01")` vira meia-noite UTC, e à noite
   * no Brasil (UTC-3) isso já é 31/12 no fuso local — o mesmo problema que
   * `todayIso()` evita ao montar a data à mão. Timestamp completo (com
   * hora) já carrega o instante certo e usa o fuso local, que é o que faz
   * sentido para "salvo às".
   */
  formatDate(iso: string | null | undefined, locale: string): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(DATE_ONLY.test(iso) ? { timeZone: "UTC" } : {}),
    }).format(date);
  }

  /**
   * Data de hoje em `AAAA-MM-DD`, no fuso local — o formato que os `<input
   * type="date">` e os campos de data do domínio usam.
   *
   * `toISOString()` não serve: converte para UTC e, à noite no Brasil,
   * devolve o dia seguinte.
   */
  todayIso(): string {
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const dia = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${mes}-${dia}`;
  }

  /**
   * Mesma ideia de `todayIso`, deslocada pra trás em dias — usada pelos
   * presets de período (últimos 30/60/90 dias etc.). Achado na REVISAO-360-
   * FRONTEND (FE-360-001): a tela de Evolução tinha sua própria versão
   * local com `toISOString().slice(0, 10)`, que converte pra UTC e, à noite
   * no Brasil, já é o dia seguinte — o mesmo problema que `todayIso` existe
   * pra evitar.
   */
  daysAgoIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
  }
}

/** Instâncias sem estado, compartilhadas pelos call sites e por quem injetar as classes em ViewModels. */
export const defaultNameFormatter = new NameFormatter();
export const defaultDateFormatter = new DateFormatter();
