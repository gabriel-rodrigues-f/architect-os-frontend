import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * Nenhum erro técnico na tela — a catraca da onda 42.
 *
 * Ordem do dono (2026-09-03), literal: *"o usuário final não pode ver erros
 * técnicos em nenhuma, absolutamente nenhuma parte da aplicação."* Ele mandou
 * junto a captura da tela de login, com a mensagem em vermelho dentro do
 * formulário:
 *
 *     POST /api/v1/auth/login falhou (404)
 *
 * O conserto está feito (`ApiFailureReading`), mas conserto não é rede: a
 * frase técnica era MONTADA em doze lugares, e a próxima onda que precisar de
 * uma mensagem de falha monta a décima terceira sem perceber. Esta é a rede.
 *
 * A régua tem três metades, porque "texto de tela" tem três endereços:
 *
 *   1. o DICIONÁRIO (`src/locales/*.json`) — todo valor é texto de tela por
 *      definição. Exceção declarada: chave terminada em `.dev`, que só é
 *      renderizada sob `import.meta.env.DEV` (a régua vizinha,
 *      `mensagem-de-usuario-nao-e-de-desenvolvedor`, já usa a mesma porta).
 *
 *   2. a POSIÇÃO DE MENSAGEM em `src/` — o argumento 0 de `new ApiError(...)`
 *      e `new UserFacingError(...)` (as duas únicas exceções cuja `message` é
 *      escrita PARA a tela), todo argumento de `toast.error/warning/info/
 *      success(...)`, e todo texto JSX. É onde a frase da captura nasceu.
 *
 *   3. QUALQUER literal de `src/`, para as marcas que nenhum identificador
 *      legítimo tem. `"/api/v1/architects"` é caminho de contrato e fica;
 *      `"GET"` é verbo de método e fica; `"GET /api/v1/architects falhou"` é
 *      frase — e só pode ser frase, porque junta verbo, caminho e prosa. Foi
 *      exatamente essa a forma dos dez vazamentos do `state-contexts.gateway`.
 *
 * O que é preso, item a item do pedido: verbo HTTP maiúsculo, `/api/`,
 * `falhou (`, status de três dígitos (escrito OU interpolado — a substituição
 * chamada `status`/`method`/`resource`/`url`), `Error:` e `stack`.
 *
 * E a última linha da ordem: o que sobrar de técnico só pode aparecer em
 * desenvolvimento. Por isso o terceiro `describe` prova que toda chave `.dev`
 * é renderizada dentro de um `import.meta.env.DEV` — nunca em produção.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../..");
const SRC = join(RAIZ, "src");

const ARQUIVOS_GERADOS = [
  join("src", "lib", "api-contract.gen.ts"),
  join("src", "routeTree.gen.ts"),
];

/** As marcas do pedido do dono, uma a uma. */
const VERBO_HTTP = /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
const CAMINHO_DE_API = /\/api\//;
const FALHOU_COM_PARENTESE = /\bfalh(?:ou|a|ando)\b[^\n]{0,24}\(/i;
const STATUS_DE_TRES_DIGITOS =
  /\((?:status\s*)?[1-5]\d{2}\)|\b(?:status|c[oó]digo|code|erro|error|HTTP)\s*:?\s*[1-5]\d{2}\b/i;
const NOME_DE_EXCECAO = /\b\w*Error:\s/;
const PILHA = /\bstack\b/i;

/**
 * Marcas de POSIÇÃO: reprovadas em dicionário, em posição de mensagem e em
 * texto JSX. Fora daí, verbo e caminho são identificador, não frase.
 */
const MARCAS_DE_TELA: ReadonlyArray<readonly [string, RegExp]> = [
  ["verbo HTTP", VERBO_HTTP],
  ["caminho da API", CAMINHO_DE_API],
  ["'falhou (' com detalhe", FALHOU_COM_PARENTESE],
  ["status de três dígitos", STATUS_DE_TRES_DIGITOS],
  ["nome de exceção", NOME_DE_EXCECAO],
  ["pilha de execução", PILHA],
];

/**
 * Marcas ABSOLUTAS: reprovadas em QUALQUER literal de `src/`, porque nenhum
 * identificador legítimo tem esta forma — só frase montada tem.
 */
const MARCAS_ABSOLUTAS: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "verbo HTTP + caminho da API na mesma frase",
    /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b[^\n]{0,60}\/api\//,
  ],
  [
    "caminho da API + verbo HTTP na mesma frase",
    /\/api\/[^\n]{0,60}\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
  ],
  ["'falhou' junto de caminho da API", /\/api\/[^\n]{0,60}\bfalh|\bfalh\w*\b[^\n]{0,60}\/api\//i],
  ["'falhou (' com detalhe", FALHOU_COM_PARENTESE],
  ["nome de exceção", NOME_DE_EXCECAO],
];

/** Nome de substituição que só existe para vazar detalhe técnico numa frase. */
const SUBSTITUICAO_TECNICA =
  /^(?:status|statusCode|method|verb|resource|endpoint|url|path|stack)$/i;

interface Ocorrencia {
  readonly onde: string;
  readonly texto: string;
}

/**
 * A SEGUNDA forma do vazamento, e a que o dono viu de outros ângulos: não a
 * frase montada, mas a mensagem de um `Error` qualquer desenhada como se
 * fosse texto de tela. `authErrorMessage` fazia isso (`if (error instanceof
 * Error) return error.message`), e `assessments.tsx` em dois lugares — então
 * um `TypeError`, um `ZodError` ou uma invariante de componente iam para o
 * formulário. Só `UserFacingError` (e sua filha `ApiError`) tem mensagem
 * escrita PARA a tela; o resto é texto de desenvolvedor.
 */
class LeituraDeErroCru {
  constructor(
    readonly onde: string,
    readonly trecho: string,
  ) {}

  get ocorrencia(): Ocorrencia {
    return { onde: this.onde, texto: this.trecho };
  }
}

/** Um literal de `src/`, com o que a árvore sabe sobre ele. */
class Literal {
  constructor(
    readonly onde: string,
    readonly texto: string,
    readonly ehPosicaoDeMensagem: boolean,
    readonly sobDev: boolean,
    readonly substituicoes: readonly string[],
  ) {}

  get ocorrencia(): Ocorrencia {
    return { onde: this.onde, texto: this.texto };
  }
}

class Dicionario {
  constructor(
    readonly idioma: string,
    private readonly chaves: Readonly<Record<string, unknown>>,
  ) {}

  /** Chave `.dev` é a exceção declarada: só existe sob `import.meta.env.DEV`. */
  infratoras(marca: RegExp): Ocorrencia[] {
    return Object.entries(this.chaves)
      .filter(([chave, valor]) => typeof valor === "string" && !chave.endsWith(".dev"))
      .filter(([, valor]) => marca.test(valor as string))
      .map(([chave, valor]) => ({ onde: `${this.idioma}:${chave}`, texto: valor as string }));
  }
}

/** Toda a fonte de `src/`, lida uma vez, classificada por posição. */
class FonteDoApp {
  private constructor(
    readonly literais: readonly Literal[],
    readonly leiturasDeErroCru: readonly LeituraDeErroCru[],
  ) {}

  static ler(raiz: string): FonteDoApp {
    const arquivos = FonteDoApp.arquivosDe(raiz);
    return new FonteDoApp(
      arquivos.flatMap((arquivo) => FonteDoApp.literaisDe(arquivo)),
      arquivos.flatMap((arquivo) => FonteDoApp.leiturasDeErroCruDe(arquivo)),
    );
  }

  /**
   * `error instanceof Error ? error.message : …` — a narrowing que autoriza a
   * tela a ler a mensagem de QUALQUER erro. A narrowing certa é
   * `instanceof UserFacingError`.
   */
  private static leiturasDeErroCruDe(arquivo: string): LeituraDeErroCru[] {
    const fonte = FonteDoApp.arvoreDe(arquivo);
    const achados: LeituraDeErroCru[] = [];
    const visitar = (no: ts.Node): void => {
      if (
        ts.isBinaryExpression(no) &&
        no.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
        no.right.getText(fonte) === "Error" &&
        FonteDoApp.leMensagemNoRamoVerdadeiro(no, fonte) &&
        !FonteDoApp.sobDev(no)
      ) {
        const linha = fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
        achados.push(
          new LeituraDeErroCru(`${relative(RAIZ, arquivo)}:${linha}`, no.getText(fonte)),
        );
      }
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
    return achados;
  }

  private static leMensagemNoRamoVerdadeiro(no: ts.Node, fonte: ts.SourceFile): boolean {
    const pai = no.parent;
    if (pai === undefined) return false;
    if (ts.isConditionalExpression(pai) && pai.condition === no) {
      return /\.message\b/.test(pai.whenTrue.getText(fonte));
    }
    if (ts.isIfStatement(pai) && pai.expression === no) {
      return /\.message\b/.test(pai.thenStatement.getText(fonte));
    }
    return false;
  }

  get emPosicaoDeMensagem(): readonly Literal[] {
    return this.literais.filter((literal) => literal.ehPosicaoDeMensagem);
  }

  private static arquivosDe(raiz: string): string[] {
    return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = join(raiz, entrada.name);
      if (entrada.isDirectory()) return FonteDoApp.arquivosDe(caminho);
      if (!/\.tsx?$/.test(entrada.name)) return [];
      return ARQUIVOS_GERADOS.includes(relative(RAIZ, caminho)) ? [] : [caminho];
    });
  }

  private static arvoreDe(arquivo: string): ts.SourceFile {
    return ts.createSourceFile(
      arquivo,
      readFileSync(arquivo, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  }

  private static literaisDe(arquivo: string): Literal[] {
    const fonte = FonteDoApp.arvoreDe(arquivo);
    const achados: Literal[] = [];
    const visitar = (no: ts.Node): void => {
      const texto = FonteDoApp.textoDe(no);
      if (texto !== null && texto.trim() !== "") {
        const linha = fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
        achados.push(
          new Literal(
            `${relative(RAIZ, arquivo)}:${linha}`,
            texto,
            FonteDoApp.ehPosicaoDeMensagem(no),
            FonteDoApp.sobDev(no),
            FonteDoApp.substituicoesDe(no, fonte),
          ),
        );
      }
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
    return achados;
  }

  /** O texto que um humano leria — nunca o identificador em volta dele. */
  private static textoDe(no: ts.Node): string | null {
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) return no.text;
    if (ts.isJsxText(no)) return no.text;
    if (ts.isTemplateExpression(no)) {
      return no.head.text + no.templateSpans.map((trecho) => trecho.literal.text).join("   ");
    }
    return null;
  }

  private static substituicoesDe(no: ts.Node, fonte: ts.SourceFile): string[] {
    if (!ts.isTemplateExpression(no)) return [];
    return no.templateSpans.map((trecho) => {
      const alvo = ts.isPropertyAccessExpression(trecho.expression)
        ? trecho.expression.name
        : trecho.expression;
      return alvo.getText(fonte);
    });
  }

  /**
   * Posição de mensagem: o argumento 0 de `new ApiError`/`new UserFacingError`
   * (as duas exceções cuja `message` é escrita PARA a tela), todo argumento de
   * `toast.*`, e todo texto JSX.
   */
  private static ehPosicaoDeMensagem(no: ts.Node): boolean {
    if (ts.isJsxText(no)) return true;
    const pai = no.parent;
    if (pai === undefined) return false;
    if (ts.isNewExpression(pai) && pai.arguments?.[0] === no) {
      return /^(?:Api|UserFacing)Error$/.test(pai.expression.getText());
    }
    if (ts.isCallExpression(pai) && pai.arguments.includes(no as ts.Expression)) {
      return /^toast\.(?:error|warning|info|success|message)$/.test(pai.expression.getText());
    }
    return false;
  }

  /** Sob `import.meta.env.DEV`: `if`, `&&` ou ternária que o testa. */
  private static sobDev(no: ts.Node): boolean {
    for (let atual: ts.Node | undefined = no.parent; atual; atual = atual.parent) {
      const condicao = FonteDoApp.condicaoDe(atual);
      if (condicao !== null && /import\.meta\.env\.DEV/.test(condicao)) return true;
    }
    return false;
  }

  private static condicaoDe(no: ts.Node): string | null {
    if (ts.isIfStatement(no)) return no.expression.getText();
    if (ts.isConditionalExpression(no)) return no.condition.getText();
    if (
      ts.isBinaryExpression(no) &&
      no.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    )
      return no.left.getText();
    return null;
  }
}

const fonte = FonteDoApp.ler(SRC);
const dicionarios = [new Dicionario("pt", pt), new Dicionario("en", en)];

describe("o dicionário não fala técnico", () => {
  for (const dicionario of dicionarios) {
    for (const [nome, marca] of MARCAS_DE_TELA) {
      it(`nenhuma chave do ${dicionario.idioma} carrega ${nome}`, () => {
        expect(dicionario.infratoras(marca)).toEqual([]);
      });
    }
  }
});

describe("nenhuma frase de tela carrega detalhe técnico", () => {
  for (const [nome, marca] of MARCAS_DE_TELA) {
    it(`nenhuma posição de mensagem de src/ carrega ${nome}`, () => {
      const infratoras = fonte.emPosicaoDeMensagem
        .filter((literal) => !literal.sobDev)
        .filter((literal) => marca.test(literal.texto))
        .map((literal) => literal.ocorrencia);
      expect(infratoras).toEqual([]);
    });
  }

  it("nenhuma frase de tela INTERPOLA status, verbo, caminho ou pilha", () => {
    const infratoras = fonte.emPosicaoDeMensagem
      .filter((literal) => !literal.sobDev)
      .filter((literal) => literal.substituicoes.some((nome) => SUBSTITUICAO_TECNICA.test(nome)))
      .map((literal) => `${literal.onde}: \${${literal.substituicoes.join("}, ${")}}`);
    expect(infratoras).toEqual([]);
  });
});

describe("nenhum literal de src/ é uma frase técnica montada", () => {
  for (const [nome, marca] of MARCAS_ABSOLUTAS) {
    it(`nenhum literal de src/ junta ${nome}`, () => {
      const infratoras = fonte.literais
        .filter((literal) => !literal.sobDev)
        .filter((literal) => marca.test(literal.texto))
        .map((literal) => literal.ocorrencia);
      expect(infratoras).toEqual([]);
    });
  }
});

describe("só UserFacingError tem mensagem escrita para a tela", () => {
  it("nenhum lugar de src/ lê a mensagem de um Error qualquer para mostrá-la", () => {
    expect(fonte.leiturasDeErroCru.map((leitura) => leitura.ocorrencia)).toEqual([]);
  });
});

describe("o que sobra de técnico só aparece em desenvolvimento", () => {
  it("toda chave `.dev` é renderizada dentro de um import.meta.env.DEV", () => {
    const foraDoGuarda = fonte.literais
      .filter((literal) => /\.dev$/.test(literal.texto))
      .filter((literal) => !literal.sobDev)
      .map((literal) => literal.ocorrencia);
    expect(foraDoGuarda).toEqual([]);
  });

  it("existe pelo menos uma chave `.dev` — se não houver, a porta é decorativa", () => {
    const chavesDev = Object.keys(pt).filter((chave) => chave.endsWith(".dev"));
    expect(chavesDev.length).toBeGreaterThan(0);
  });
});

describe("a varredura enxerga o app inteiro — catraca não pode ser decorativa", () => {
  it("lê milhares de literais de src/", () => {
    expect(fonte.literais.length).toBeGreaterThan(1000);
  });

  it("enxerga posição de mensagem de verdade — texto JSX, toast e ApiError", () => {
    expect(fonte.emPosicaoDeMensagem.length).toBeGreaterThan(100);
  });

  /**
   * O oráculo das marcas: cada régua é medida contra a frase que ela existe
   * para pegar, e contra a frase legítima que ela NÃO pode pegar. Sem isto,
   * uma regex quebrada num refactor deixaria a catraca verde e cega.
   */
  const EXEMPLOS: ReadonlyArray<{
    readonly marca: RegExp;
    readonly pega: string;
    readonly poupa: string;
  }> = [
    { marca: VERBO_HTTP, pega: "POST /api/v1/auth/login falhou (404)", poupa: "Poste a evidência" },
    {
      marca: CAMINHO_DE_API,
      pega: "POST /api/v1/auth/login falhou (404)",
      poupa: "api de terceiros",
    },
    {
      marca: FALHOU_COM_PARENTESE,
      pega: "POST /api/v1/auth/login falhou (404)",
      poupa: "A avaliação falhou em dois critérios",
    },
    {
      marca: STATUS_DE_TRES_DIGITOS,
      pega: "POST /api/v1/auth/login falhou (404)",
      poupa: "Avaliação 360 com 100 respostas",
    },
    { marca: NOME_DE_EXCECAO, pega: "TypeError: Failed to fetch", poupa: "Erro ao salvar" },
    { marca: PILHA, pega: "stack: at Object.fetch", poupa: "pilha de tarefas" },
    {
      marca: SUBSTITUICAO_TECNICA,
      pega: "status",
      poupa: "nomeDaPessoa",
    },
  ];

  for (const { marca, pega, poupa } of EXEMPLOS) {
    it(`a marca ${marca.source.slice(0, 28)}… pega "${pega}" e poupa "${poupa}"`, () => {
      expect(marca.test(pega), `deixaria "${pega}" passar`).toBe(true);
      expect(marca.test(poupa), `reprovaria "${poupa}", que é texto legítimo`).toBe(false);
    });
  }

  it("a captura do dono é reprovada por pelo menos uma marca de cada metade da régua", () => {
    const capturaDoDono = "POST /api/v1/auth/login falhou (404)";
    expect(MARCAS_DE_TELA.filter(([, marca]) => marca.test(capturaDoDono)).length).toBe(4);
    expect(MARCAS_ABSOLUTAS.filter(([, marca]) => marca.test(capturaDoDono)).length).toBe(3);
  });
});
