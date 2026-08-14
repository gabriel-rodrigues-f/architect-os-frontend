import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import {
  availableLocales,
  BASE_LOCALE,
  baseMessages,
  detectLocale,
  interpolate,
  isKnownLocale,
  loadMessages,
  type LocaleInfo,
  type MessageBundle,
  type MessageKey,
} from "./registry";

const STORAGE_KEY = "architect-os:locale";

export interface I18nApi {
  locale: string;
  locales: LocaleInfo[];
  /** `true` enquanto o pacote do idioma escolhido ainda está sendo baixado. */
  loading: boolean;
  setLocale: (code: string) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nApi | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  /**
   * Começa no idioma base e só decide o real depois da montagem: no SSR não há
   * `localStorage` nem `navigator`, e escolher no primeiro render quebraria a
   * hidratação.
   */
  const [locale, setLocaleState] = useState(BASE_LOCALE);
  const [messages, setMessages] = useState<MessageBundle>(baseMessages);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    const inicial =
      salvo && isKnownLocale(salvo)
        ? salvo
        : detectLocale(navigator.languages ?? [navigator.language]);
    if (inicial !== BASE_LOCALE) setLocaleState(inicial);
  }, []);

  // Busca o pacote quando o idioma muda. `cancelado` evita que uma resposta
  // atrasada sobrescreva uma escolha mais recente.
  useEffect(() => {
    if (locale === BASE_LOCALE) {
      setMessages(baseMessages);
      return;
    }
    let cancelado = false;
    setLoading(true);
    loadMessages(locale)
      .then((bundle) => {
        if (!cancelado) setMessages(bundle);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((code: string) => {
    if (!isKnownLocale(code)) return;
    window.localStorage.setItem(STORAGE_KEY, code);
    setLocaleState(code);
  }, []);

  /**
   * Chave ausente cai no idioma base — tradução parcial mostra o texto
   * original, nunca a chave crua. Em desenvolvimento avisa no console, para a
   * lacuna não passar despercebida.
   */
  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => {
      const texto = messages[key] ?? baseMessages[key];
      if (texto === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] chave sem tradução: ${key}`);
        return key;
      }
      return interpolate(texto, params);
    },
    [messages],
  );

  return (
    <Ctx.Provider value={{ locale, locales: availableLocales(), loading, setLocale, t }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n(): I18nApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n precisa estar dentro de I18nProvider");
  return ctx;
}
