import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Um link quebrado é pior que o arquivo removido: manda quem lê procurar algo
 * que não existe. Este teste trava a documentação viva — todo caminho relativo
 * escrito num `.md` do repositório precisa existir na árvore.
 *
 * Fora do alcance, de propósito: URLs (não dá para resolver offline), âncoras
 * puras e caminhos que saem da raiz do repositório — o README aponta para
 * `../backend/docs/RUNBOOK.md`, que só existe no clone irmão do backend.
 */

const raizDoRepositorio = resolve(__dirname, "..", "..");

const pastasIgnoradas = new Set([
  ".git",
  ".output",
  ".tanstack",
  ".worktrees",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function arquivosMarkdown(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      return pastasIgnoradas.has(entrada.name) ? [] : arquivosMarkdown(caminho);
    }
    return entrada.name.endsWith(".md") ? [caminho] : [];
  });
}

function ehRelativo(alvo: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(alvo) && !alvo.startsWith("#") && !alvo.startsWith("//");
}

function semAncoraNemQuery(alvo: string): string {
  return alvo.split("#")[0]?.split("?")[0] ?? "";
}

function alvosRelativos(markdown: string): string[] {
  const links = [...markdown.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)];
  return links.flatMap((link) => {
    const bruto = link[1];
    if (bruto === undefined || !ehRelativo(bruto)) return [];
    const alvo = semAncoraNemQuery(bruto);
    return alvo.length > 0 ? [alvo] : [];
  });
}

function saiDoRepositorio(destino: string): boolean {
  const caminhoRelativo = relative(raizDoRepositorio, destino);
  return caminhoRelativo.startsWith("..") || caminhoRelativo.startsWith(`..${sep}`);
}

describe("links dos arquivos markdown", () => {
  const quebrados = arquivosMarkdown(raizDoRepositorio).flatMap((arquivo) => {
    const pastaDoArquivo = resolve(arquivo, "..");
    return alvosRelativos(readFileSync(arquivo, "utf8"))
      .map((alvo) => ({
        arquivo: relative(raizDoRepositorio, arquivo),
        alvo,
        destino: resolve(pastaDoArquivo, alvo),
      }))
      .filter(({ destino }) => !saiDoRepositorio(destino) && !existsSync(destino))
      .map(({ arquivo, alvo }) => `${arquivo} -> ${alvo}`);
  });

  it("não aponta para arquivo ou pasta que não existe", () => {
    expect(quebrados).toEqual([]);
  });
});
