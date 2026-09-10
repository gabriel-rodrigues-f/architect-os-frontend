import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * A ELEGIBILIDADE SAIU DO PRODUTO — o conceito inteiro, não só a tela.
 *
 * Dono, 2026-09-10: *"Remova os critérios de elegibilidade. Remova este
 * conceito da plataforma. Vamos manter os níveis e comparativos, mas não
 * quero mais cravar na pedra 'para ser júnior precisa de 1 capacidade', 'para
 * ser pleno precisa de 2', pois isso pode envolver também soft skill. Com
 * isso o menu 'Elegibilidade' morre e junto com ele tudo relacionado a ele,
 * incluindo seus bloqueios, no front, back e banco."*
 *
 * O QUE MORRE AQUI: a tela `/eligibility`, o painel de veredito da Avaliação
 * (o medidor com "elegível a X"), a linha "elegível/não elegível" do
 * assistente de prontidão, o tipo `AssessmentEligibility`, o método do
 * gateway, a rota no contrato gerado e as chaves de i18n que diziam o
 * veredito.
 *
 * O QUE FICA, e ele foi explícito: os NÍVEIS e os COMPARATIVOS. A escala
 * L1–L5, a aderência, a distância até o esperado e o radar continuam — o
 * último teste deste arquivo prova a escala de pé, porque a ressalva dele
 * sobre a Referência do Modelo (*"morre essa tela, mas continuamos a utilizar
 * esse modelo nas demais telas"*) vale para o lote inteiro.
 *
 * Esta catraca existe porque a remoção NÃO quebra compilação em todo lugar:
 * uma chave de i18n órfã em um dos dois dicionários, ou a rota sobrando no
 * `api-contract.gen.ts`, passam pelo typecheck sem um pio.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * As grafias com que o VEREDITO se escrevia na casa: o tipo do domínio, o
 * método do gateway, a chave de cache, a rota, o piso e as chaves de i18n.
 *
 * `collectiveEligible` (Necessidades de Treinamento) NÃO entra: aquele
 * "elegível" é sobre quantas pessoas justificam uma trilha coletiva — nada a
 * ver com subir de nível. Por isso a régua lista grafias EXATAS em vez de
 * varrer a raiz "eligib".
 */
const AS_GRAFIAS_DO_VEREDITO =
  /AssessmentEligibility|assessmentEligibility|assessment-eligibility|eligibilityKey|eligibility\.title|eligibility\.leadOnly|help\.eligibility|ai\.readiness\.(not)?[Ee]ligible|asmt\.portfolio\.eligible|minimumQualifiedCapabilities|qualifiedConfirmedCount|careerMinimumQualifiedFloor|career\.minimumQualifiedFloor|\/eligibility/;

/**
 * O que a régua mede é CÓDIGO: símbolo, rota, chave de i18n, texto de tela.
 * Comentário que explica por que o conceito saiu é justamente o que se quer
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

/** O veredito como o dono o via escrito na tela, nas duas línguas. */
const O_VEREDITO_NA_TELA = /eleg[íi]vel|not eligible|is eligible|elegibilidade|eligibility/i;

describe("a elegibilidade saiu do produto (dono, 2026-09-10)", () => {
  it("nenhum símbolo, rota ou chave de src/ nomeia o veredito — o contrato gerado incluído", () => {
    const culpados = arquivosDe(join(raiz, "src"))
      .filter((arquivo) =>
        AS_GRAFIAS_DO_VEREDITO.test(semComentarios(readFileSync(arquivo, "utf8"))),
      )
      .map((arquivo) => arquivo.slice(raiz.length + 1));
    expect(culpados).toEqual([]);
  });

  it("a tela morreu — não existe mais arquivo de rota da elegibilidade", () => {
    expect(readdirSync(join(raiz, "src", "routes"))).not.toContain("eligibility.tsx");
  });

  for (const idioma of ["pt", "en"] as const) {
    it(`nenhuma chave nem texto de tela em ${idioma} diz o veredito`, () => {
      const catalogo = catalogos[idioma]!;
      const culpadas = Object.entries(catalogo)
        .filter(
          ([chave, texto]) => AS_GRAFIAS_DO_VEREDITO.test(chave) || O_VEREDITO_NA_TELA.test(texto),
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

  it("a rota some do inventário de alcance por rota", () => {
    const fixture = readFileSync(
      join(raiz, "tests", "architecture", "alcance-por-rota.fixture.json"),
      "utf8",
    );
    expect(fixture).not.toContain("/eligibility");
  });

  /**
   * A OUTRA METADE DA DECISÃO. O dono mandou manter *"os níveis e
   * comparativos"*, e reforçou na ressalva da Referência do Modelo:
   * *"morre essa tela, mas continuamos a utilizar esse modelo nas demais
   * telas."* A ESCALA L1–L5 é esse modelo — a legenda que a Avaliação, o PDI
   * e os selos de nível usam. Se alguém a apagar "por consistência com a
   * elegibilidade", é aqui que a conta não fecha.
   */
  it("a escala L1–L5 continua viva — o modelo sobrevive à tela que o exibia", async () => {
    const { LEVELS } = await import("@/lib/domain");

    expect(LEVELS.map((entry) => entry.level)).toEqual([1, 2, 3, 4, 5]);
    // Chave LITERAL, em forma de array: o ponto num `toHaveProperty` de
    // string seria lido como caminho aninhado, e o dicionário é plano.
    for (const { level } of LEVELS) {
      expect(pt).toHaveProperty([`level.${level}`]);
      expect(pt).toHaveProperty([`level.${level}.description`]);
      expect(en).toHaveProperty([`level.${level}`]);
      expect(en).toHaveProperty([`level.${level}.description`]);
    }
    // A legenda da escala, que a tela de Referência do Modelo exibia e as
    // outras telas continuam usando.
    expect(pt).toHaveProperty(["level.scale.label"]);
    expect(en).toHaveProperty(["level.scale.label"]);
  });
});
