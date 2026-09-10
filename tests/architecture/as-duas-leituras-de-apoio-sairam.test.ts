import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * AS DUAS LEITURAS DE APOIO SAÍRAM DO PRODUTO — e não voltam pela porta dos
 * fundos.
 *
 * Dono, 2026-09-10: *"Em Catálogo de Competências: remova 'Leitura de Apoio a
 * Curadoria' e tudo relacionado a isso, front, IA, backend e banco."* E,
 * perguntado se a irmã dela na Calibração de Líderes saía junto: *"Sai."*
 *
 * Eram a MESMA peça em duas telas: um cartão com botão, `observations` (o que
 * o sistema apurou) e `reading` (o que a IA escreveu). Saem os dois blocos, o
 * componente que os desenhava, os dois métodos do gateway, o schema de
 * resposta, as chaves `ai.catalog.*`, `ai.calibration.*` e `ai.work.*`, e os
 * dois caminhos do contrato gerado.
 *
 * **O que sai JUNTO e precisa ser dito em voz alta:** o filtro *"Profissional
 * para a leitura de apoio"* da Calibração (`ai.calibration.person`). Ele
 * existia SÓ para escolher de quem seria a leitura, e sem leitura não escolhe
 * nada. O filtro de CICLO fica — ele é da tela, não da IA.
 *
 * Esta catraca existe porque a remoção NÃO quebra compilação em todo lugar:
 * uma chave de i18n órfã em um dos dois dicionários, ou um caminho sobrando no
 * `api-contract.gen.ts`, passam pelo typecheck sem um pio.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * As grafias com que as duas se escreviam na casa: as rotas, os métodos do
 * gateway, o schema, o componente e os prefixos de i18n.
 *
 * `alertAboutStagnation`, `StagnationAlert` e `naturalLanguageReadingAvailability`
 * NÃO entram: o aviso de estagnação fica, e a pergunta de disponibilidade
 * continua sendo o que a tela dele faz antes de desenhar o botão.
 */
const AS_GRAFIAS =
  /calibration-assistance|quality-review|assistAssessmentCalibration|reviewCatalogQuality|workAssistanceResponseSchema|WorkAssistanceSection|WorkAssistanceRun|WorkAssistanceBody|ai\.calibration\.|ai\.catalog\.|ai\.work\./;

/** As chaves de dicionário que morrem, pelo prefixo. */
const AS_CHAVES = /^ai\.(calibration|catalog|work)\./;

/**
 * O que a régua mede é CÓDIGO: símbolo, rota, chave de i18n, texto de tela.
 * Comentário que EXPLICA por que as duas saíram é justamente o que se quer ler
 * daqui a um ano — sai da conta antes da busca. Mesmo desenho de
 * `o-comecar-parar-continuar-saiu-do-produto.test.ts`.
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

/** O título de cada bloco, nas duas línguas — o que o dono via na tela. */
const OS_TITULOS =
  /Leitura de apoio à (curadoria|calibração)|Support reading for (curation|calibration)/i;

describe("as duas leituras de apoio saíram do produto (dono, 2026-09-10)", () => {
  it("nenhum símbolo, rota ou componente de src/ nomeia qualquer uma das duas", () => {
    const culpados = arquivosDe(join(raiz, "src"))
      .filter((arquivo) => AS_GRAFIAS.test(semComentarios(readFileSync(arquivo, "utf8"))))
      .map((arquivo) => arquivo.slice(raiz.length + 1));

    expect(culpados).toEqual([]);
  });

  for (const idioma of ["pt", "en"] as const) {
    it(`nenhuma chave nem texto de tela em ${idioma} fala das duas leituras`, () => {
      const catalogo = catalogos[idioma]!;
      const culpadas = Object.entries(catalogo)
        .filter(([chave, texto]) => AS_CHAVES.test(chave) || OS_TITULOS.test(texto))
        .map(([chave]) => chave);

      expect(culpadas).toEqual([]);
    });
  }

  it("os dois catálogos terminam com exatamente o mesmo conjunto de chaves", () => {
    const soEmPt = Object.keys(pt).filter((chave) => !(chave in en));
    const soEmEn = Object.keys(en).filter((chave) => !(chave in pt));

    expect({ soEmPt, soEmEn }).toEqual({ soEmPt: [], soEmEn: [] });
  });

  /*
   * O caso do SELETOR DE PESSOA da Calibração saiu daqui em 2026-09-10, à
   * tarde: a tela inteira saiu do produto no mesmo dia (`as-cinco-telas-
   * sairam.test.ts`), e afirmar que um filtro não está num arquivo que não
   * existe é rede que passa por vacuidade. A varredura de `src/` acima cobre
   * o que sobrou desta remoção.
   */

  it("a cópia do contrato de erro do backend perdeu a recusa de alcance da calibração", () => {
    const fixture = readFileSync(
      join(raiz, "tests", "architecture", "a-recusa-fala-o-idioma-de-quem-le.fixture.json"),
      "utf8",
    );

    expect(fixture).not.toContain("CalibrationAssistanceNotLead");
  });

  /**
   * A FRONTEIRA, afirmada pelo lado positivo.
   *
   * Existem DUAS coisas chamadas "curadoria" no produto. A que MORREU é a
   * *leitura de apoio à curadoria*: texto gerado por IA sobre o catálogo. A
   * que FICA é o ESTADO da capacidade — `REQUIRES_CURATION`, calculado no
   * backend a partir das contagens, sem IA nenhuma —, e é ele que alimenta o
   * aviso *"Curadoria pendente em {capacidades}"* de Modelo de Carreira →
   * Perfil de Competências do Time, além do controle de curadoria da própria
   * matriz.
   *
   * É o mesmo caso da Evidência: `evidenceType.certification` morreu e
   * `learningItemType.certificacao` ficou. Palavra igual, coisa diferente —
   * e estas linhas existem para que a próxima varredura por "curadoria" não
   * atropele o aviso achando que atropela a IA.
   */
  describe("a fronteira: o ESTADO da capacidade não é a leitura de apoio", () => {
    it("o aviso 'Curadoria pendente em {capacidades}' continua nos dois dicionários", () => {
      expect(pt).toHaveProperty("teamRules.capability.curationNotice");
      expect(en).toHaveProperty("teamRules.capability.curationNotice");
    });

    it("as chaves de curadoria que sobreviveram são as do ESTADO, e são as mesmas nos dois", () => {
      const doEstado = (catalogo: Record<string, string>): string[] =>
        Object.keys(catalogo).filter((chave) => /curation/i.test(chave));

      expect(doEstado(pt).length).toBeGreaterThan(0);
      expect(doEstado(en)).toEqual(doEstado(pt));
    });

    it("`REQUIRES_CURATION` continua sendo lido do contrato, e não some com a IA", () => {
      const dominio = readFileSync(join(raiz, "src", "lib", "domain.ts"), "utf8");

      expect(dominio).toContain("REQUIRES_CURATION");
    });
  });
});
