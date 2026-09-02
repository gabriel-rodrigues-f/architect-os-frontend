import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * Vocabulário positivo — a catraca da palavra "lacuna".
 *
 * Pedido literal do dono (2026-09-01): "já pedi para não utilizar a palavra
 * 'lacuna'. remova de toda a aplicação. Precisamos ser mais positivos.
 * Substitua isso por 'Competências em evolução'".
 *
 * É pedido REPETIDO — foi feito antes, nunca chegou a ser registrado, e a
 * palavra voltou em 31 chaves do `pt.json`. Uma pendência que reaparece é
 * defeito de rede, não de memória: enquanto o único verificador for alguém
 * lembrar, ela volta uma terceira vez. Esta é a rede.
 *
 * A régua, em duas metades:
 *   1. nenhum VALOR de `pt.json` ou `en.json` contém "lacuna" (em qualquer
 *      flexão), e nenhum valor do `en.json` contém "gap" como palavra isolada
 *      — o equivalente inglês do mesmo pedido;
 *   2. nenhuma string literal, template ou texto JSX de `src/` contém
 *      "lacuna" — texto cru na tela é proibido pela régua de i18n, mas as
 *      meta descriptions das rotas são literais legítimas e já carregavam a
 *      palavra.
 *
 * O que NÃO é texto de usuário fica fora: identificador não é vocabulário.
 * A rota `/gap-analysis`, o prefixo de chave `gap.` e nomes como
 * `openGaps` continuam existindo — a catraca lê o VALOR das chaves, nunca
 * o nome; e em `src/` só lê literal de texto, nunca identificador. Em
 * `src/`, "gap" não é reprovado: `className="flex gap-2"` é Tailwind, e a
 * palavra inglesa isolada só vive nos literais de en.json.
 *
 * Segunda palavra, mesmo mecanismo (dono, 2026-09-02): "de modo geral em
 * toda a solução eu não quero mais o conceito de Arquiteto de Soluções 1, 2
 * ou 3. eu quero Junior, Pleno e Senior, isso vale para todos os times".
 * O nome do nível é DADO — vem de `GET /career-levels` — e nunca deveria ter
 * sido fixado em texto de tela, em tipo ou em fixture. Os IDS
 * (`arquiteto-de-solucoes-i|ii|iii`) são identificadores, ficam, e a catraca
 * não os lê: ela reprova só o NOME numerado, em pt e em en, nos valores dos
 * dicionários, nos literais de `src/` e nas fixtures de `tests/helpers/`.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../..");
const SRC = join(RAIZ, "src");
const FIXTURES = join(RAIZ, "tests", "helpers");

const PALAVRA_PROIBIDA_NAS_DUAS_LINGUAS = /lacuna/i;
const PALAVRA_PROIBIDA_EM_INGLES = /\bgaps?\b/i;
const NIVEL_NUMERADO_EM_PORTUGUES = /Arquiteto de Solu(?:ç|c)(?:ões|oes)\s+(?:I{1,3}|IV|[1-4])\b/i;
const NIVEL_NUMERADO_EM_INGLES = /Solutions? Architect\s+(?:I{1,3}|IV|[1-4])\b/i;

const ARQUIVOS_GERADOS = [
  join("src", "lib", "api-contract.gen.ts"),
  join("src", "routeTree.gen.ts"),
];

interface Ocorrencia {
  readonly onde: string;
  readonly texto: string;
}

class Dicionario {
  constructor(
    readonly idioma: string,
    private readonly chaves: Readonly<Record<string, unknown>>,
    private readonly proibidas: readonly RegExp[],
  ) {}

  get infratoras(): Ocorrencia[] {
    return Object.entries(this.chaves)
      .filter(([, valor]) => typeof valor === "string")
      .filter(([, valor]) => this.proibidas.some((proibida) => proibida.test(valor as string)))
      .map(([chave, valor]) => ({ onde: `${this.idioma}:${chave}`, texto: valor as string }));
  }
}

/** Todo texto que um usuário pode ler, extraído da árvore — nunca um identificador. */
class TextosDaFonte {
  private constructor(readonly ocorrencias: readonly Ocorrencia[]) {}

  static de(raiz: string): TextosDaFonte {
    const ocorrencias = TextosDaFonte.arquivosDe(raiz).flatMap((arquivo) =>
      TextosDaFonte.textosDe(arquivo),
    );
    return new TextosDaFonte(ocorrencias);
  }

  infratoras(proibida: RegExp): Ocorrencia[] {
    return this.ocorrencias.filter((ocorrencia) => proibida.test(ocorrencia.texto));
  }

  private static arquivosDe(raiz: string): string[] {
    return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = join(raiz, entrada.name);
      if (entrada.isDirectory()) return TextosDaFonte.arquivosDe(caminho);
      if (!/\.tsx?$/.test(entrada.name)) return [];
      return ARQUIVOS_GERADOS.includes(relative(RAIZ, caminho)) ? [] : [caminho];
    });
  }

  private static textosDe(arquivo: string): Ocorrencia[] {
    const fonte = ts.createSourceFile(
      arquivo,
      readFileSync(arquivo, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const achados: Ocorrencia[] = [];
    const registrar = (no: ts.Node, texto: string) => {
      const linha = fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
      achados.push({ onde: `${relative(RAIZ, arquivo)}:${linha}`, texto });
    };
    const visitar = (no: ts.Node): void => {
      if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
        registrar(no, no.text);
      } else if (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) {
        registrar(no, no.text);
      } else if (ts.isJsxText(no)) {
        registrar(no, no.text);
      }
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
    return achados;
  }
}

const textosDaFonte = TextosDaFonte.de(SRC);
const textosDasFixtures = TextosDaFonte.de(FIXTURES);

describe("vocabulário positivo — 'lacuna' não volta", () => {
  it("nenhum valor do pt.json diz 'lacuna'", () => {
    const dicionario = new Dicionario("pt", pt, [PALAVRA_PROIBIDA_NAS_DUAS_LINGUAS]);
    expect(dicionario.infratoras).toEqual([]);
  });

  it("nenhum valor do en.json diz 'lacuna' nem 'gap' como palavra isolada", () => {
    const dicionario = new Dicionario("en", en, [
      PALAVRA_PROIBIDA_NAS_DUAS_LINGUAS,
      PALAVRA_PROIBIDA_EM_INGLES,
    ]);
    expect(dicionario.infratoras).toEqual([]);
  });

  it("nenhum texto literal de src/ diz 'lacuna' — nem meta description, nem texto cru", () => {
    expect(textosDaFonte.infratoras(PALAVRA_PROIBIDA_NAS_DUAS_LINGUAS)).toEqual([]);
  });

  it("a varredura de src/ lê alguma coisa — se vier vazia, a catraca é decorativa", () => {
    expect(textosDaFonte.ocorrencias.length).toBeGreaterThan(1000);
  });

  it("a varredura de src/ enxerga texto de meta description, não só chamadas de t()", () => {
    const metaDescriptions = textosDaFonte.ocorrencias.filter((ocorrencia) =>
      ocorrencia.onde.startsWith(join("src", "routes")),
    );
    expect(metaDescriptions.length).toBeGreaterThan(20);
  });
});

describe("nível de carreira agnóstico — 'Júnior/II/III' não volta", () => {
  it("nenhum valor do pt.json numera o nível como 'Júnior/II/III'", () => {
    const dicionario = new Dicionario("pt", pt, [NIVEL_NUMERADO_EM_PORTUGUES]);
    expect(dicionario.infratoras).toEqual([]);
  });

  it("nenhum valor do en.json numera o nível — nem em português, nem como 'Solutions Architect I'", () => {
    const dicionario = new Dicionario("en", en, [
      NIVEL_NUMERADO_EM_PORTUGUES,
      NIVEL_NUMERADO_EM_INGLES,
    ]);
    expect(dicionario.infratoras).toEqual([]);
  });

  it("nenhum literal de src/ fixa o nome numerado do nível — nem em tipo, nem em texto: o nome vem da API", () => {
    expect(textosDaFonte.infratoras(NIVEL_NUMERADO_EM_PORTUGUES)).toEqual([]);
    expect(textosDaFonte.infratoras(NIVEL_NUMERADO_EM_INGLES)).toEqual([]);
  });

  it("as fixtures de tests/helpers/ nascem com os nomes novos", () => {
    expect(textosDasFixtures.infratoras(NIVEL_NUMERADO_EM_PORTUGUES)).toEqual([]);
    expect(textosDasFixtures.infratoras(NIVEL_NUMERADO_EM_INGLES)).toEqual([]);
  });

  it("a varredura das fixtures lê alguma coisa — se vier vazia, a catraca é decorativa", () => {
    expect(textosDasFixtures.ocorrencias.length).toBeGreaterThan(50);
  });
});
