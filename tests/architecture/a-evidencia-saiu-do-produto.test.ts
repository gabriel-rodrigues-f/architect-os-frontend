import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import { emptyState } from "@/lib/selectors";
import { VOCABULARY_NAMES } from "@/lib/vocabularies";

/**
 * A EVIDÊNCIA SAIU DO PRODUTO — e não volta pela porta dos fundos.
 *
 * Dono, 2026-09-08 (regra 17 de `direcao/papeis-2026-09-06.md`): *"Pode
 * remover evidência."* A remoção é completa — módulo, telas, chaves de i18n,
 * fatia de estado e vocabulário. Como a Evidência nunca teve rota nem entrada
 * de menu, não há arquivo de rota para conferir se sumiu: ela morava DENTRO de
 * cinco telas, e o que prova a saída é a ausência do vocabulário dela em toda
 * parte. Se voltar um dia, volta como coisa nova, desenhada do zero — e esta
 * catraca é o lugar onde essa decisão vai ser tomada de novo, à vista.
 *
 * As duas exceções abaixo são nomeadas de propósito, porque nenhuma das duas é
 * a ENTIDADE: a "Corrida de carreira" é um easter egg em que o corredor recolhe
 * losangos, e `advice-semiotics` casa o VERBO "evidencia" no texto livre da IA
 * para escolher um ícone.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const NAO_E_A_ENTIDADE = [
  join("src", "lib", "career-run"),
  join("src", "components", "app", "CareerRunCanvas.tsx"),
  join("src", "lib", "advice-semiotics.ts"),
];

/** Pega "evidence", "evidência", "evidências", "EVIDENCE_TYPE" e "evidenciar". */
const A_PALAVRA = /evid[êe]nc/i;

/**
 * O que a régua mede é CÓDIGO: símbolo, rota, chave de i18n, texto de tela.
 * Comentário que explica por que a evidência saiu é justamente o que se quer
 * ler daqui a um ano, então sai da conta antes da busca.
 */
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

describe("a Evidência saiu do produto (dono, 2026-09-08, regra 17)", () => {
  it("nenhum símbolo, rota ou texto de src/ nomeia a evidência — fora o easter egg e o verbo da IA", () => {
    const culpados = arquivosDe(join(raiz, "src"))
      .filter((arquivo) => !arquivo.endsWith("api-contract.gen.ts"))
      .filter((arquivo) => !NAO_E_A_ENTIDADE.some((excecao) => arquivo.includes(excecao)))
      .filter((arquivo) => A_PALAVRA.test(semComentarios(readFileSync(arquivo, "utf8"))))
      .map((arquivo) => arquivo.slice(raiz.length + 1));
    expect(culpados).toEqual([]);
  });

  for (const idioma of ["pt", "en"] as const) {
    it(`nenhuma chave nem texto de tela em ${idioma} fala de evidência`, () => {
      const catalogo = catalogos[idioma]!;
      const culpadas = Object.entries(catalogo)
        .filter(([chave, texto]) => A_PALAVRA.test(chave) || A_PALAVRA.test(texto))
        .map(([chave]) => chave);
      expect(culpadas).toEqual([]);
    });
  }

  it("os dois catálogos terminam com exatamente o mesmo conjunto de chaves", () => {
    const soEmPt = Object.keys(pt).filter((chave) => !(chave in en));
    const soEmEn = Object.keys(en).filter((chave) => !(chave in pt));
    expect({ soEmPt, soEmEn }).toEqual({ soEmPt: [], soEmEn: [] });
  });

  it("a fatia de estado e o vocabulário da evidência não existem mais", () => {
    expect(Object.keys(emptyState)).not.toContain("evidences");
    expect([...VOCABULARY_NAMES]).not.toContain("EVIDENCE_TYPE");
  });

  /**
   * A JORNADA SAIU DA TELA (dono, 2026-09-10): *"Remova o Avaliar →
   * Priorizar… etc, etc do canto superior da tela."* Ela era o texto que este
   * arquivo vigiava para garantir que o passo EVIDENCIAR não voltasse; sem
   * texto, o que resta a prender é que ele não volte por uma chave nova — e é
   * isso que os dois testes de catálogo acima já fazem, para a palavra
   * inteira. O que fica aqui é a prova de que a frase não vive mais em lugar
   * nenhum, em nenhum dos dois idiomas.
   */
  it("a jornada anunciada no topo não existe mais em catálogo nenhum", () => {
    const catalogos: Record<string, string>[] = [pt, en];
    for (const catalogo of catalogos) {
      expect(catalogo["shell.flow"]).toBeUndefined();
      expect(Object.values(catalogo).filter((texto) => texto.includes("→ Priorizar"))).toEqual([]);
    }
  });
});
