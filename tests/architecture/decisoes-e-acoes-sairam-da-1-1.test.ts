import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * DECISÕES E AÇÕES SAÍRAM DA 1:1 — e não voltam pela porta dos fundos.
 *
 * Dono, 2026-09-09: *"o menu Mentoria e 1:1 é somente para anotações de 1:1.
 * as únicas coisas que quero ver são Preparação do 1:1, gerado por IA, como já
 * está, regua cronológica de mentorias e um único bloco de anotações chamado
 * 'Notas'. não quero mais menu de seleção de competências, não quero mais
 * vinculo aqui com PDI."* E logo depois: *"inclusive, ainda estou vendo no
 * frontend os campos decisões e ações. deve morrer totalmente, front, back e
 * banco."*
 *
 * No molde de `a-evidencia-saiu-do-produto.test.ts`: o que a régua mede é
 * CÓDIGO — símbolo, chave de i18n, forma do tipo. Comentário que explica por
 * que os campos saíram é justamente o que se quer ler daqui a um ano, então
 * sai da conta antes da busca.
 *
 * AS ISENÇÕES, UMA A UMA — nenhuma delas é o CAMPO DA 1:1, e a lista está
 * escrita porque isenção que não se lê é buraco:
 *
 *  1. `src/lib/api-contract.gen.ts` — é GERADO a partir do spec do backend
 *     (`npm run gen:api`). O que ele diz sobre a 1:1 é consequência do
 *     contrato, não decisão desta tela; quem guarda o contrato é o backend.
 *  2. `src/lib/error-page.ts` — o `actions` de lá é a CLASSE CSS `.actions`
 *     do HTML embutido da página de erro (a faixa dos dois botões), e não
 *     campo de sessão nenhum.
 *  3. `*.col.actions` nas chaves de i18n — colunas de tabela de outras telas
 *     (Time, Usuários, Times, Elenco do time). Estas ficam de fora pela
 *     própria régua `A_CHAVE`, que só olha o prefixo `mentor.`.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const NAO_E_O_CAMPO_DA_1A1 = [
  join("src", "lib", "api-contract.gen.ts"),
  join("src", "lib", "error-page.ts"),
];

/**
 * Pega `decisions` em qualquer forma, e `actions` só quando é campo da sessão
 * ou chave de objeto — nunca `team.table.col.actions` e as três irmãs dela,
 * que são colunas de tabela de outras telas.
 */
const O_CAMPO = /\bdecisions\b|\b(?:session|sessao|s)\.actions\b|["'`]actions["'`]/i;

/** Chave de i18n de bloco/botão da 1:1 — não confunde com `team.table.col.actions`. */
const A_CHAVE = /^mentor\.(?:block\.(?:decisions|actions)|toPdi\.)/;

const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function arquivosDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const catalogos = { pt, en } as Record<string, Record<string, string>>;

describe("Decisões e Ações saíram da 1:1 (dono, 2026-09-09)", () => {
  it("nenhum símbolo de src/ nomeia decisions ou actions da 1:1", () => {
    const culpados = arquivosDe(join(raiz, "src"))
      .filter((arquivo) => !NAO_E_O_CAMPO_DA_1A1.some((excecao) => arquivo.includes(excecao)))
      .filter((arquivo) => O_CAMPO.test(semComentarios(readFileSync(arquivo, "utf8"))))
      .map((arquivo) => arquivo.slice(raiz.length + 1));
    expect(culpados).toEqual([]);
  });

  for (const idioma of ["pt", "en"] as const) {
    it(`nenhuma chave de ${idioma} rotula bloco de decisões/ações nem o botão do PDI`, () => {
      const culpadas = Object.keys(catalogos[idioma]!).filter((chave) => A_CHAVE.test(chave));
      expect(culpadas).toEqual([]);
    });
  }

  it("a interface MentoringSession não declara competencyIds, decisions nem actions", () => {
    const dominio = readFileSync(join(raiz, "src", "lib", "domain.ts"), "utf8");
    const bloco = /export interface MentoringSession \{([\s\S]*?)\n\}/.exec(dominio);
    expect(bloco).not.toBeNull();
    const campos = semComentarios(bloco![1]!)
      .split("\n")
      .map((linha) => /^\s*(\w+)\??:/.exec(linha)?.[1])
      .filter((campo): campo is string => Boolean(campo));
    expect(campos).not.toContain("competencyIds");
    expect(campos).not.toContain("decisions");
    expect(campos).not.toContain("actions");
    // A régua 20 (dono, 2026-09-09): o follow-up fica de pé.
    expect(campos).toContain("nextSession");
  });
});
