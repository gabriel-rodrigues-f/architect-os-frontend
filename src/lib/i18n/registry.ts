import base from "@/locales/pt.json";

export type MessageKey = Exclude<keyof typeof base, "$label">;

export type MessageBundle = Partial<Record<MessageKey, string>>;

export const BASE_LOCALE = "pt";

export const baseMessages = base as MessageBundle & { $label: string };

const loaders = import.meta.glob<{ default: MessageBundle & { $label: string } }>(
  "../../locales/*.json",
);

const codeOf = (path: string) => path.replace(/^.*\/([^/]+)\.json$/, "$1");

export interface LocaleInfo {
  code: string;

  label: string;
}

function autonym(code: string): string {
  try {
    const nome = new Intl.DisplayNames([code], { type: "language" }).of(code);
    if (!nome || nome === code) return code.toUpperCase();

    return nome.charAt(0).toLocaleUpperCase(code) + nome.slice(1);
  } catch {
    return code.toUpperCase();
  }
}

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

export async function loadMessages(code: string): Promise<MessageBundle> {
  if (code === BASE_LOCALE) return baseMessages;

  const entry = Object.entries(loaders).find(([path]) => codeOf(path) === code);
  if (!entry) return baseMessages;

  const modulo = await entry[1]();
  labelCache.set(code, modulo.default.$label ?? autonym(code));
  return modulo.default;
}

export function detectLocale(languages: readonly string[]): string {
  for (const tag of languages) {
    const code = tag.toLowerCase().split("-")[0] ?? "";
    if (isKnownLocale(code)) return code;
  }
  return BASE_LOCALE;
}

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (todo, chave: string) =>
    chave in params ? String(params[chave]) : todo,
  );
}
