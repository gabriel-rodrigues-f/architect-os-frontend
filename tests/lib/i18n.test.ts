import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import {
  availableLocales,
  BASE_LOCALE,
  detectLocale,
  interpolate,
  isKnownLocale,
} from "@/lib/i18n";

/**
 * O framework descobre idiomas a partir dos arquivos em `src/locales`. Estes
 * testes protegem a promessa central: adicionar um JSON basta para o idioma
 * existir, e uma tradução incompleta nunca mostra chave crua na tela.
 */

describe("catálogo de idiomas", () => {
  it("descobre os idiomas pelos arquivos, sem lista no código", () => {
    const codigos = availableLocales().map((l) => l.code);
    expect(codigos).toContain("pt");
    expect(codigos).toContain("en");
  });

  /** Só português e inglês estão habilitados nesta etapa — espanhol foi retirado. */
  it("não lista idioma sem arquivo correspondente", () => {
    const codigos = availableLocales().map((l) => l.code);
    expect(codigos).toEqual(["pt", "en"]);
  });

  it("põe o idioma base primeiro", () => {
    expect(availableLocales()[0]?.code).toBe(BASE_LOCALE);
  });

  it("usa o rótulo declarado dentro do próprio arquivo", () => {
    expect(availableLocales().find((l) => l.code === "pt")?.label).toBe("Português");
  });

  /**
   * Regressão: o seletor mostrava "Português", "EN", "ES" — só o idioma ativo
   * saía por extenso, porque os demais só têm `$label` depois de carregados.
   */
  it("mostra todo idioma por extenso, mesmo antes de carregar o arquivo", () => {
    for (const { code, label } of availableLocales()) {
      expect(label.length, code).toBeGreaterThan(3);
      expect(label, code).not.toBe(code.toUpperCase());
    }
  });

  it("cada idioma aparece no próprio idioma", () => {
    const porCodigo = new Map(availableLocales().map((l) => [l.code, l.label]));
    expect(porCodigo.get("en")).toBe("English");
  });

  it("reconhece só os idiomas que existem", () => {
    expect(isKnownLocale("en")).toBe(true);
    expect(isKnownLocale("es")).toBe(false);
    expect(isKnownLocale("de")).toBe(false);
  });
});

describe("detecção pelo navegador", () => {
  it("casa a região com o idioma: pt-BR → pt", () => {
    expect(detectLocale(["pt-BR", "pt"])).toBe("pt");
  });

  /** Espanhol foi retirado do catálogo: deixa de casar e cai no primeiro idioma conhecido. */
  it("pula idiomas que não existem e fica no primeiro conhecido", () => {
    expect(detectLocale(["es-AR", "ja", "en-US"])).toBe("en");
  });

  it("sem nenhum conhecido, cai no base", () => {
    expect(detectLocale(["de", "ja"])).toBe(BASE_LOCALE);
  });
});

describe("interpolação", () => {
  it("substitui os marcadores nomeados", () => {
    expect(interpolate("Olá, {nome}!", { nome: "Ana" })).toBe("Olá, Ana!");
  });

  it("aceita número", () => {
    expect(interpolate("{n} competências", { n: 3 })).toBe("3 competências");
  });

  it("deixa intacto o marcador sem valor, em vez de imprimir undefined", () => {
    expect(interpolate("Olá, {nome}!", {})).toBe("Olá, {nome}!");
  });

  it("sem parâmetros devolve o texto original", () => {
    expect(interpolate("Texto simples")).toBe("Texto simples");
  });
});

describe("integridade das traduções", () => {
  const chaves = (arquivo: object) => Object.keys(arquivo).filter((k) => k !== "$label");

  it("todo idioma declara seu rótulo de exibição", () => {
    for (const [nome, arquivo] of Object.entries({ pt, en })) {
      expect(typeof (arquivo as { $label?: string }).$label, nome).toBe("string");
    }
  });

  /** Chave a mais num idioma é chave que ninguém usa — ou erro de digitação. */
  it("nenhum idioma tem chave que não exista no base", () => {
    const base = new Set(chaves(pt));
    const sobrando = chaves(en).filter((k) => !base.has(k));
    expect(sobrando, "en tem chaves fora do base").toEqual([]);
  });

  /** O inglês é o idioma alvo desta etapa: precisa cobrir tudo. */
  it("o inglês cobre todas as chaves do base", () => {
    const faltando = chaves(pt).filter((k) => !(k in en));
    expect(faltando, `en não traduz: ${faltando.slice(0, 8).join(", ")}`).toEqual([]);
  });
});
