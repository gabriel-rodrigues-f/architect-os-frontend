import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Série única de ADR — a rede da regra universal 17.
 *
 * Texto da regra: "ADR mora SÓ em `backend/docs/adr/`, série única por
 * repositório. Decisão de frontend vai para `frontend/DECISOES.md` do
 * repositório de direção, nunca em ADR próprio."
 *
 * A regra nasceu de uma colisão real: este repositório manteve os ADRs
 * `0022`, `0024`, `0025` e `0028` e três deles carregavam o mesmo número de
 * ADRs de assunto COMPLETAMENTE diferente no backend — 0022 aqui era foco e
 * rótulo, lá é invalidação de cache; 0024 aqui era barril de componentes, lá
 * é o nome da operação; 0028 aqui era guarda de navegação, lá é a âncora do
 * escopo. Citar "ADR-0024" sem dizer o repositório apontava para dois
 * documentos ao mesmo tempo.
 *
 * A regra estava escrita e não era cumprida — ninguém a impunha. Este teste é
 * a automação exigida pela regra 28: achado que já mordeu vira teste do gate,
 * em vez de depender de alguém reler a governança.
 *
 * O que ele proíbe neste repositório: qualquer diretório `adr/` e qualquer
 * arquivo com a forma de ADR numerado (`NNNN-titulo.md`). Decisão de frontend
 * vai para `direcao/frontend/DECISOES.md`; referência cruzada cita
 * `backend/NNNN`, e continua livre em prosa.
 */

const raizDoRepositorio = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const DIRETORIOS_IGNORADOS = new Set([
  ".git",
  ".output",
  ".vinxi",
  ".worktrees",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const NOME_DE_ADR = /^\d{4}-.+\.md$/;

function arquivosComFormaDeAdr(diretorio: string, encontrados: string[] = []): string[] {
  for (const entrada of readdirSync(diretorio)) {
    if (DIRETORIOS_IGNORADOS.has(entrada)) continue;
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      if (entrada === "adr") encontrados.push(relative(raizDoRepositorio, caminho));
      arquivosComFormaDeAdr(caminho, encontrados);
      continue;
    }
    if (NOME_DE_ADR.test(entrada)) encontrados.push(relative(raizDoRepositorio, caminho));
  }
  return encontrados;
}

describe("série única de ADR (regra universal 17)", () => {
  it("não guarda ADR próprio: a série é do backend, a decisão de frontend é do DECISOES.md da direção", () => {
    expect(arquivosComFormaDeAdr(raizDoRepositorio)).toEqual([]);
  });
});
