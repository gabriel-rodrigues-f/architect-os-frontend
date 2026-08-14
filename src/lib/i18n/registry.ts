import base from "@/locales/pt.json";

/**
 * Catálogo de idiomas — descoberto a partir dos arquivos, não de uma lista.
 *
 * ## Como adicionar um idioma
 *
 * Crie `src/locales/<código>.json` copiando `pt.json` e traduzindo os valores.
 * Nada mais. O seletor, o carregamento e o fallback passam a considerá-lo
 * sozinhos — não há lista de idiomas para atualizar em lugar nenhum, que é
 * justamente onde esse tipo de recurso costuma quebrar.
 *
 * ## Por que sem biblioteca
 *
 * `i18next` é a escolha padrão quando se precisa de plural por idioma, formato
 * ICU, detecção por servidor e carregamento remoto. Nada disso está em jogo
 * aqui: o app tem um conjunto fechado de textos e idiomas com plural regular.
 * O `import.meta.glob` do Vite já entrega descoberta automática e divisão de
 * código, que é a parte difícil — o resto seria peso morto.
 *
 * Se um dia entrarem plurais complexos ou tradução vinda de um serviço, a
 * troca é contida: `MessageBundle` é a única interface que o app consome.
 */

/** Chave de mensagem — derivada do idioma base, então o TypeScript acusa erro de digitação. */
export type MessageKey = Exclude<keyof typeof base, "$label">;

export type MessageBundle = Partial<Record<MessageKey, string>>;

/** Idioma base: sempre presente no pacote, porque é o fallback de tudo. */
export const BASE_LOCALE = "pt";

export const baseMessages = base as MessageBundle & { $label: string };

/**
 * Um módulo por arquivo em `locales/`, carregado sob demanda. Sem `eager`, o
 * Vite gera um chunk separado por idioma: quem usa português não baixa inglês.
 */
const loaders = import.meta.glob<{ default: MessageBundle & { $label: string } }>(
  "../../locales/*.json",
);

const codeOf = (path: string) => path.replace(/^.*\/([^/]+)\.json$/, "$1");

export interface LocaleInfo {
  /** Código ISO, o mesmo do nome do arquivo (`pt`, `en`, `es`, `fr`…). */
  code: string;
  /** Nome exibido no seletor, lido da chave `$label` do próprio arquivo. */
  label: string;
}

/**
 * Nome do idioma no próprio idioma — "português", "English", "español".
 *
 * Vem do `Intl.DisplayNames` em vez do arquivo porque o arquivo só é lido
 * quando o idioma é escolhido: antes disso o seletor mostrava o código em
 * maiúsculo ("EN", "ES") ao lado do nome por extenso do idioma ativo. Pelo
 * `Intl`, o nome está disponível de imediato e vale para qualquer código novo,
 * sem precisar baixar nada.
 */
function autonym(code: string): string {
  try {
    const nome = new Intl.DisplayNames([code], { type: "language" }).of(code);
    if (!nome || nome === code) return code.toUpperCase();
    // Alguns idiomas devolvem em minúscula ("português"); no seletor viram nome próprio.
    return nome.charAt(0).toLocaleUpperCase(code) + nome.slice(1);
  } catch {
    return code.toUpperCase();
  }
}

/** `$label` do arquivo tem precedência: permite um nome fora do padrão do Intl. */
const labelCache = new Map<string, string>([[BASE_LOCALE, base.$label]]);

export function availableLocales(): LocaleInfo[] {
  return Object.keys(loaders)
    .map(codeOf)
    .sort((a, b) => (a === BASE_LOCALE ? -1 : b === BASE_LOCALE ? 1 : a.localeCompare(b)))
    .map((code) => ({ code, label: labelCache.get(code) ?? autonym(code) }));
}

export function isKnownLocale(code: string): boolean {
  return Object.keys(loaders).map(codeOf).includes(code);
}

/** Carrega o pacote de um idioma; devolve o base se o arquivo não existir. */
export async function loadMessages(code: string): Promise<MessageBundle> {
  if (code === BASE_LOCALE) return baseMessages;

  const entry = Object.entries(loaders).find(([path]) => codeOf(path) === code);
  if (!entry) return baseMessages;

  const modulo = await entry[1]();
  labelCache.set(code, modulo.default.$label ?? autonym(code));
  return modulo.default;
}

/**
 * Melhor palpite a partir do navegador: `pt-BR` casa com `pt`. Só é usado
 * quando a pessoa ainda não escolheu um idioma.
 */
export function detectLocale(languages: readonly string[]): string {
  for (const tag of languages) {
    const code = tag.toLowerCase().split("-")[0] ?? "";
    if (isKnownLocale(code)) return code;
  }
  return BASE_LOCALE;
}

/**
 * Substitui `{nome}` pelos valores informados. É o mínimo que evita concatenar
 * string na tela — concatenação quebra em idiomas com outra ordem de frase.
 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (todo, chave: string) =>
    chave in params ? String(params[chave]) : todo,
  );
}
