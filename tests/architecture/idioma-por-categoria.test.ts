import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Idioma por categoria — a catraca do frontend (varredura-oo-ddd-2026-08-29).
 *
 * Ordem do dono, literal: "o frontend está pouquíssimo orientado a objeto e
 * DDD. quero uma revisão rigorosa sobre isso. ele pode utilizar função, por
 * conta do framework, mas quero que seja mais orientado a objeto,
 * componentizado e inteligente."
 *
 * É a mesma catraca do `backend/tests/architecture/oo-puro.test.ts`: a
 * varredura de 2026-08-29 mediu a dívida em main, o plano de ondas (R2–R6) a
 * paga aos poucos, e sem esta rede cada fatia nova reintroduz função solta
 * mais rápido do que as ondas removem. A baseline gravada na fixture SÓ
 * DESCE. Subir a contagem de qualquer arquivo — ou estrear arquivo novo com
 * código solto — é vermelho na hora, com arquivo, linha e nome.
 *
 * O que conta como violação, no top-level de módulo em `src/`:
 *   - `function` solta (declaração que não é componente nem hook);
 *   - `const f = () =>` / `const f = function` — função disfarçada de const;
 *   - `const X = forwardRef(...)` / `memo(...)` — componente no idioma
 *     const, contra a régua "componente = function declaration";
 *   - `let`/`var` de módulo e `const x = new Map()/new Set()` — estado de
 *     módulo, o anti-OO direto (closures de error-capture, text.ts, i18n).
 *
 * Exceções de plataforma, NOMEADAS como o backend nomeou o `genReqId`
 * (varredura §3a, ratificada pelo plano de ondas):
 *   P1 componente React = `function NomeMaiusculo()` em arquivo `.tsx` —
 *      React com hooks não funciona em classe; o framework exige função.
 *   P2 hook = `function useX()` — as Rules of Hooks exigem função chamada
 *      durante render. O hook é adaptador fino; a lógica mora na classe.
 *   P3 `src/components/ui/` inteiro — shadcn vendorizado; converter quebra
 *      o diff contra o upstream (precedente: DECISOES.md protege
 *      popover.tsx). Código nosso em `components/app/` não herda a exceção.
 *   P4 `src/router.tsx`, `src/server.ts`, `src/start.ts`,
 *      `src/lib/query-client.ts` — assinatura do TanStack Start
 *      (precedente `genReqId`). Arquivos `*.gen.ts` são gerados.
 *   P5 `cn()` de `src/lib/utils.ts` — idioma shadcn, fica.
 *   P6 `const x = new X()` — singleton de composição, o idioma que fecha
 *      todas as classes (E2 do backend). Map/Set ficam FORA da exceção:
 *      são estado, não composição.
 *   P7 destructure de import, arrays `as const` (artefato de tipo), flags
 *      de entrypoint ESM e constantes imutáveis de dados — a régua do
 *      frontend permite "class + tipos + constantes de dados" em lib.
 *
 * Baixar a baseline junto com cada onda: rode
 * `ATUALIZAR_BASELINE_IDIOMA=1 npx vitest run tests/architecture/idioma-por-categoria.test.ts`
 * no mesmo commit que remove as violações. A regeneração se recusa a SUBIR
 * o total — catraca até para quem a gira. Conflito de merge na fixture
 * resolve-se pela soma dos deltas contra a base (REGRAS.md 16); este
 * próprio teste é o oráculo.
 */

const raizDoRepositorio = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE = join(
  raizDoRepositorio,
  "tests",
  "architecture",
  "idioma-por-categoria.fixture.json",
);

const ARQUIVOS_DE_PLATAFORMA = new Set([
  join("src", "router.tsx"),
  join("src", "server.ts"),
  join("src", "start.ts"),
  join("src", "lib", "query-client.ts"),
]);
const DIRETORIO_SHADCN = `${join("src", "components", "ui")}${sep}`;

class ViolacaoDeIdioma {
  constructor(
    readonly arquivo: string,
    readonly linha: number,
    readonly especie: "function solta" | "const-função" | "componente-const" | "estado de módulo",
    readonly nome: string,
  ) {}

  toString(): string {
    return `${this.arquivo}:${this.linha} → ${this.especie} \`${this.nome}\``;
  }
}

function arquivosFonteEm(diretorio: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...arquivosFonteEm(caminho));
      continue;
    }
    if (!entrada.endsWith(".ts") && !entrada.endsWith(".tsx")) continue;
    if (entrada.endsWith(".gen.ts")) continue;
    encontrados.push(caminho);
  }
  return encontrados;
}

function ehHook(nome: string): boolean {
  return /^use[A-Z0-9_]/.test(nome);
}

function ehComponenteDeclarado(nome: string, arquivo: string): boolean {
  return /^[A-Z]/.test(nome) && arquivo.endsWith(".tsx");
}

function ehIdiomaShadcnRatificado(arquivo: string, nome: string): boolean {
  return arquivo === join("src", "lib", "utils.ts") && nome === "cn";
}

function ehDestructureDeImport(declaracao: ts.VariableDeclaration): boolean {
  return (
    (ts.isObjectBindingPattern(declaracao.name) || ts.isArrayBindingPattern(declaracao.name)) &&
    declaracao.initializer !== undefined &&
    ts.isIdentifier(declaracao.initializer)
  );
}

function ehFlagDeEntrypoint(declaracao: ts.VariableDeclaration, fonte: ts.SourceFile): boolean {
  const texto = declaracao.getText(fonte);
  return texto.includes("import.meta.url") || texto.includes("process.argv");
}

function ehFuncaoDisfarcada(inicializador: ts.Expression): boolean {
  return ts.isArrowFunction(inicializador) || ts.isFunctionExpression(inicializador);
}

function ehComponenteConst(inicializador: ts.Expression): boolean {
  if (!ts.isCallExpression(inicializador)) return false;
  const chamada = inicializador.expression.getText();
  return chamada === "forwardRef" || chamada === "memo" || chamada === "React.forwardRef";
}

function ehEstadoDeModulo(inicializador: ts.Expression): boolean {
  if (!ts.isNewExpression(inicializador)) return false;
  const construtor = inicializador.expression.getText();
  return construtor === "Map" || construtor === "Set" || construtor === "WeakMap";
}

function violacoesDe(caminho: string): ViolacaoDeIdioma[] {
  const arquivo = relative(raizDoRepositorio, caminho);
  const fonte = ts.createSourceFile(
    arquivo,
    readFileSync(caminho, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const linhaDe = (no: ts.Node): number =>
    fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
  const violacoes: ViolacaoDeIdioma[] = [];

  for (const declaracao of fonte.statements) {
    if (ts.isFunctionDeclaration(declaracao) && declaracao.name) {
      const nome = declaracao.name.text;
      if (ehHook(nome)) continue;
      if (ehComponenteDeclarado(nome, arquivo)) continue;
      if (ehIdiomaShadcnRatificado(arquivo, nome)) continue;
      violacoes.push(new ViolacaoDeIdioma(arquivo, linhaDe(declaracao), "function solta", nome));
      continue;
    }
    if (!ts.isVariableStatement(declaracao)) continue;
    const ehConst = (declaracao.declarationList.flags & ts.NodeFlags.Const) !== 0;
    for (const variavel of declaracao.declarationList.declarations) {
      const nome = variavel.name.getText(fonte);
      if (!ehConst) {
        violacoes.push(new ViolacaoDeIdioma(arquivo, linhaDe(variavel), "estado de módulo", nome));
        continue;
      }
      if (ehDestructureDeImport(variavel)) continue;
      if (ehFlagDeEntrypoint(variavel, fonte)) continue;
      const inicializador = variavel.initializer;
      if (!inicializador) continue;
      if (ehFuncaoDisfarcada(inicializador)) {
        violacoes.push(new ViolacaoDeIdioma(arquivo, linhaDe(variavel), "const-função", nome));
        continue;
      }
      if (ehComponenteConst(inicializador)) {
        violacoes.push(new ViolacaoDeIdioma(arquivo, linhaDe(variavel), "componente-const", nome));
        continue;
      }
      if (ehEstadoDeModulo(inicializador)) {
        violacoes.push(new ViolacaoDeIdioma(arquivo, linhaDe(variavel), "estado de módulo", nome));
      }
    }
  }
  return violacoes;
}

const arquivosVarridos = arquivosFonteEm(join(raizDoRepositorio, "src")).filter((caminho) => {
  const arquivo = relative(raizDoRepositorio, caminho);
  if (ARQUIVOS_DE_PLATAFORMA.has(arquivo)) return false;
  return !arquivo.startsWith(DIRETORIO_SHADCN);
});

const violacoesPorArquivo = new Map<string, ViolacaoDeIdioma[]>();
for (const caminho of arquivosVarridos) {
  const violacoes = violacoesDe(caminho);
  if (violacoes.length > 0) {
    violacoesPorArquivo.set(relative(raizDoRepositorio, caminho), violacoes);
  }
}
const totalAtual = [...violacoesPorArquivo.values()].reduce(
  (soma, lista) => soma + lista.length,
  0,
);

interface BaselineDeIdioma {
  total: number;
  porArquivo: Record<string, number>;
}

function gravarBaseline(): BaselineDeIdioma {
  const porArquivo: Record<string, number> = {};
  for (const arquivo of [...violacoesPorArquivo.keys()].sort()) {
    porArquivo[arquivo] = violacoesPorArquivo.get(arquivo)?.length ?? 0;
  }
  const baseline: BaselineDeIdioma = { total: totalAtual, porArquivo };
  writeFileSync(FIXTURE, `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
}

function carregarBaseline(): BaselineDeIdioma {
  const anterior = existsSync(FIXTURE)
    ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as BaselineDeIdioma)
    : undefined;
  if (process.env["ATUALIZAR_BASELINE_IDIOMA"] === "1") {
    if (anterior && totalAtual > anterior.total) return anterior;
    return gravarBaseline();
  }
  if (!anterior) throw new Error(`baseline ausente: ${relative(raizDoRepositorio, FIXTURE)}`);
  return anterior;
}

const baseline = carregarBaseline();

describe("idioma por categoria — a catraca da varredura 2026-08-29", () => {
  it("a fixture é íntegra: o total é a soma dos arquivos", () => {
    const soma = Object.values(baseline.porArquivo).reduce(
      (total, contagem) => total + contagem,
      0,
    );
    expect(soma).toBe(baseline.total);
  });

  it("nenhum arquivo ganha função solta, const-função ou estado de módulo além da própria baseline", () => {
    const ofensores: string[] = [];
    for (const [arquivo, violacoes] of violacoesPorArquivo) {
      const permitidas = baseline.porArquivo[arquivo] ?? 0;
      if (violacoes.length > permitidas) {
        ofensores.push(
          `${arquivo}: ${violacoes.length} violações (baseline ${permitidas}) —\n` +
            violacoes.map((violacao) => `  ${violacao.toString()}`).join("\n"),
        );
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("a contagem total só desce, nunca sobe", () => {
    expect(totalAtual).toBeLessThanOrEqual(baseline.total);
  });
});
