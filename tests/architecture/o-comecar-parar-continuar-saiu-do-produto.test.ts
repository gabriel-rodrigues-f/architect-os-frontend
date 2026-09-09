import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * O "COMEÇAR / PARAR / CONTINUAR" SAIU DO PRODUTO — e não volta pela porta
 * dos fundos.
 *
 * Dono, 2026-09-09: *"Em avaliação de competências, vamos remover o 'Começar
 * / Parar / Continuar'. Remova de tudo, front, back e banco."* A remoção é
 * completa, no molde da regra 17 (foi assim que a Evidência saiu): a seção
 * inteira da tela de Avaliação de Desempenho, o formulário, o gateway, o
 * método do view model, o tipo do domínio, as 16 chaves `asmt.devSummary.*` e
 * o caminho no contrato gerado.
 *
 * **O que se perde e é preciso dizer em voz alta:** este campo tinha ganhado
 * HOJE MESMO o aviso de sucesso ao salvar (`msg.assessment.developmentSummary.
 * update.success`), porque era o único campo da Avaliação em que o texto
 * digitado ficava igual no acerto e no erro. Com o campo fora, o aviso sai
 * junto — e é consequência assumida, não esquecimento.
 *
 * Esta catraca existe porque a remoção NÃO quebra compilação em todo lugar:
 * uma chave de i18n órfã em um dos dois dicionários, ou o caminho sobrando no
 * `api-contract.gen.ts`, passam pelo typecheck sem um pio.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * As grafias com que o campo se escrevia na casa: o tipo do domínio, o método
 * do gateway, o caminho da rota, o prefixo das chaves de i18n e os três
 * campos. Uma só que sobreviva devolve o campo pela metade.
 */
const AS_GRAFIAS =
  /developmentSummary|DevelopmentSummary|development-summary|devSummary|startDoing|stopDoing|continueDoing/;

/**
 * O que a régua mede é CÓDIGO: símbolo, rota, chave de i18n, texto de tela.
 * Comentário que explica por que o campo saiu é justamente o que se quer ler
 * daqui a um ano, então sai da conta antes da busca. Mesmo desenho de
 * `a-evidencia-saiu-do-produto.test.ts`.
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

/** O título da seção, nas duas línguas — o que o dono via na tela. */
const O_TITULO = /Começar\s*\/\s*Parar\s*\/\s*Continuar|Start\s*\/\s*Stop\s*\/\s*Continue/i;

describe("o Começar/Parar/Continuar saiu do produto (dono, 2026-09-09)", () => {
  it("nenhum símbolo, rota ou texto de src/ nomeia o campo — o contrato gerado incluído", () => {
    const culpados = arquivosDe(join(raiz, "src"))
      .filter((arquivo) => AS_GRAFIAS.test(semComentarios(readFileSync(arquivo, "utf8"))))
      .map((arquivo) => arquivo.slice(raiz.length + 1));
    expect(culpados).toEqual([]);
  });

  for (const idioma of ["pt", "en"] as const) {
    it(`nenhuma chave nem texto de tela em ${idioma} fala do campo`, () => {
      const catalogo = catalogos[idioma]!;
      const culpadas = Object.entries(catalogo)
        .filter(
          ([chave, texto]) =>
            AS_GRAFIAS.test(chave) || AS_GRAFIAS.test(texto) || O_TITULO.test(texto),
        )
        .map(([chave]) => chave);
      expect(culpadas).toEqual([]);
    });
  }

  it("os dois catálogos terminam com exatamente o mesmo conjunto de chaves", () => {
    const soEmPt = Object.keys(pt).filter((chave) => !(chave in en));
    const soEmEn = Object.keys(en).filter((chave) => !(chave in pt));
    expect({ soEmPt, soEmEn }).toEqual({ soEmPt: [], soEmEn: [] });
  });

  it("o aviso de sucesso do salvar morreu junto com o campo, nos dois dicionários", () => {
    expect(pt).not.toHaveProperty("msg.assessment.developmentSummary.update.success");
    expect(en).not.toHaveProperty("msg.assessment.developmentSummary.update.success");
  });

  it("a cópia dos message codes do backend não anuncia mais o código órfão", () => {
    const fixture = readFileSync(
      join(raiz, "tests", "lib", "message-codes-de-sucesso.fixture.json"),
      "utf8",
    );
    expect(fixture).not.toContain("assessment.developmentSummary.update.success");
  });

  it("a cópia do contrato de erro do backend perdeu o conflito de versão do campo", () => {
    const fixture = readFileSync(
      join(raiz, "tests", "architecture", "a-recusa-fala-o-idioma-de-quem-le.fixture.json"),
      "utf8",
    );
    expect(fixture).not.toContain("AssessmentDevelopmentSummary");
  });
});
