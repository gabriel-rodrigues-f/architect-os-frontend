import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * CQ-04 — barril mal feito cria dependência circular que o bundler resolve em
 * silêncio: o módulo importado no meio do ciclo chega parcialmente inicializado
 * e a falha aparece em runtime, numa rota, não no gate. Esta é a rede.
 *
 * O grafo é o de RUNTIME: `import type` e `export type` saem, porque some na
 * emissão e nunca chega a ser aresta de inicialização. `import()` dinâmico
 * também sai — é justamente a aresta que QUEBRA ciclo (`charts` ->
 * `charts-recharts`), e contá-la acusaria ciclo onde não há.
 */
const raizDoRepo = process.cwd();
const raizDeOrigem = path.join(raizDoRepo, "src");

const EXTENSOES = [".ts", ".tsx"];

const arquivosDeOrigem = (diretorio: string): string[] =>
  readdirSync(diretorio).flatMap((entrada) => {
    const caminho = path.join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) return arquivosDeOrigem(caminho);
    return EXTENSOES.includes(path.extname(caminho)) ? [caminho] : [];
  });

const ehArquivo = (caminho: string): boolean => {
  try {
    return statSync(caminho).isFile();
  } catch {
    return false;
  }
};

const resolveEspecificador = (origem: string, especificador: string): string | null => {
  const base = especificador.startsWith("@/")
    ? path.join(raizDeOrigem, especificador.slice(2))
    : especificador.startsWith(".")
      ? path.resolve(path.dirname(origem), especificador)
      : null;
  if (base === null) return null;

  const candidatos = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidatos.find(ehArquivo) ?? null;
};

const especificadoresDeRuntime = (arquivo: string): string[] => {
  const fonte = ts.createSourceFile(
    arquivo,
    readFileSync(arquivo, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const especificadores: string[] = [];
  for (const declaracao of fonte.statements) {
    if (ts.isImportDeclaration(declaracao)) {
      if (declaracao.importClause?.isTypeOnly === true) continue;
      if (ts.isStringLiteral(declaracao.moduleSpecifier)) {
        especificadores.push(declaracao.moduleSpecifier.text);
      }
      continue;
    }
    if (ts.isExportDeclaration(declaracao)) {
      if (declaracao.isTypeOnly) continue;
      const especificador = declaracao.moduleSpecifier;
      if (especificador !== undefined && ts.isStringLiteral(especificador)) {
        especificadores.push(especificador.text);
      }
    }
  }
  return especificadores;
};

const grafoDeImportacao = (): Map<string, string[]> => {
  const grafo = new Map<string, string[]>();
  for (const arquivo of arquivosDeOrigem(raizDeOrigem)) {
    const destinos = especificadoresDeRuntime(arquivo)
      .map((especificador) => resolveEspecificador(arquivo, especificador))
      .filter((destino): destino is string => destino !== null && destino !== arquivo);
    grafo.set(arquivo, destinos);
  }
  return grafo;
};

const relativo = (arquivo: string) => path.relative(raizDoRepo, arquivo);

const ciclos = (grafo: Map<string, string[]>): string[][] => {
  const encontrados: string[][] = [];
  const encerrados = new Set<string>();
  const naPilha = new Set<string>();
  const pilha: string[] = [];

  const visita = (arquivo: string) => {
    if (encerrados.has(arquivo)) return;
    if (naPilha.has(arquivo)) {
      const inicio = pilha.indexOf(arquivo);
      encontrados.push([...pilha.slice(inicio), arquivo].map(relativo));
      return;
    }
    naPilha.add(arquivo);
    pilha.push(arquivo);
    for (const destino of grafo.get(arquivo) ?? []) visita(destino);
    pilha.pop();
    naPilha.delete(arquivo);
    encerrados.add(arquivo);
  };

  for (const arquivo of grafo.keys()) visita(arquivo);
  return encontrados;
};

describe("CQ-04 — barris não podem fechar ciclo de importação", () => {
  it("não há ciclo no grafo de runtime de src/", () => {
    const encontrados = ciclos(grafoDeImportacao());

    expect(encontrados.map((ciclo) => ciclo.join(" -> "))).toEqual([]);
  });

  it("o detector enxerga um ciclo quando ele existe", () => {
    const grafoDeMentira = new Map<string, string[]>([
      [path.join(raizDeOrigem, "a.ts"), [path.join(raizDeOrigem, "index.ts")]],
      [path.join(raizDeOrigem, "index.ts"), [path.join(raizDeOrigem, "a.ts")]],
    ]);

    expect(ciclos(grafoDeMentira).map((ciclo) => ciclo.join(" -> "))).toEqual([
      "src/a.ts -> src/index.ts -> src/a.ts",
    ]);
  });

  it("o grafo cobre a árvore inteira, não um punhado de arquivos", () => {
    expect(grafoDeImportacao().size).toBeGreaterThan(100);
  });
});
