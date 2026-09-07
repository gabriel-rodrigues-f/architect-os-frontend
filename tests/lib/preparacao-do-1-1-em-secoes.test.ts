import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  OneOnOnePreparationReading,
  OneOnOnePreparationSections,
} from "@/lib/one-on-one-preparation";

/**
 * Os títulos das três seções da preparação do 1:1 são CONTRATO com o
 * backend: o briefing de lá instrui o modelo a abri-las com estes títulos, e
 * a tela os reconhece para desenhar cada seção. A fixture ao lado é a CÓPIA
 * de `backend/tests/modules/assistants/preparacao-do-1-1-secoes.fixture.json`,
 * como a de `message-codes`. Quando os dois repositórios estão lado a lado,
 * a cópia é conferida contra o original — uma cópia defasada é vermelho aqui.
 */
const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIA = join(AQUI, "preparacao-do-1-1-secoes.fixture.json");
const ORIGINAL = join(
  AQUI,
  "../../../backend/tests/modules/assistants/preparacao-do-1-1-secoes.fixture.json",
);

const lerJson = (caminho: string): unknown => JSON.parse(readFileSync(caminho, "utf8"));

describe("as seções da preparação do 1:1 são o mesmo contrato do backend", () => {
  it("o objeto da tela é exatamente a fixture copiada", () => {
    expect(OneOnOnePreparationSections.contract()).toEqual(lerJson(COPIA));
  });

  it("a cópia não está defasada do original do backend (quando ele está ao lado)", () => {
    let original: unknown;
    try {
      original = lerJson(ORIGINAL);
    } catch {
      return;
    }
    expect(
      lerJson(COPIA),
      `cópia defasada: rode "cp ${ORIGINAL} tests/lib/preparacao-do-1-1-secoes.fixture.json"`,
    ).toEqual(original);
  });

  it("a ordem é a do dono: liturgia, resumo do perfil e, por fim, SWOT", () => {
    expect(OneOnOnePreparationSections.ORDER).toEqual([
      "Liturgia do 1:1",
      "Resumo do perfil",
      "SWOT",
    ]);
  });
});

const NARRACAO = [
  "Liturgia do 1:1:",
  "– Abrir perguntando como foi a semana.",
  "– Retomar o combinado sobre o item de PDI.",
  "Resumo do perfil:",
  "Ana é arquiteta plena há três anos no time de Plataforma.",
  "SWOT:",
  "Forças:",
  "– Integração acima do exigido.",
  "Fraquezas:",
  "– Distância 2 em Domain Modeling.",
  "Oportunidades:",
  "– Trilha de dados em andamento.",
  "Ameaças:",
  "– Última 1:1 há 40 dias.",
].join("\n");

describe("a narração lida por seção", () => {
  it("reconhece os três títulos na ordem em que vieram, com o texto de cada um", () => {
    const leitura = OneOnOnePreparationReading.of(NARRACAO);

    expect(leitura?.sections.map((secao) => secao.title)).toEqual([
      "Liturgia do 1:1",
      "Resumo do perfil",
      "SWOT",
    ]);
    expect(leitura?.sections[0]?.text).toContain("Abrir perguntando");
    expect(leitura?.sections[1]?.text).toBe(
      "Ana é arquiteta plena há três anos no time de Plataforma.",
    );
    expect(leitura?.preamble).toBe("");
  });

  it("ignora caixa e acento no título, e o que vem antes do primeiro título é preâmbulo", () => {
    const leitura = OneOnOnePreparationReading.of(
      ["Uma frase de abertura.", "LITURGIA DO 1:1:", "– Abrir.", "resumo do perfil:", "Ana."].join(
        "\n",
      ),
    );

    expect(leitura?.preamble).toBe("Uma frase de abertura.");
    expect(leitura?.sections.map((secao) => secao.title)).toEqual([
      "Liturgia do 1:1",
      "Resumo do perfil",
    ]);
  });

  it("sem nenhum dos títulos não há o que seccionar — o narrador determinístico cai aqui", () => {
    expect(
      OneOnOnePreparationReading.of("Sobre preparação do 1:1 com Ana: A conversa é com Ana."),
    ).toBeNull();
  });

  it("uma frase que só CONTÉM o título não é título", () => {
    expect(OneOnOnePreparationReading.of("A Liturgia do 1:1 é importante.")).toBeNull();
  });

  it("o SWOT vira quadrantes só com os QUATRO presentes", () => {
    const swot = OneOnOnePreparationReading.of(NARRACAO)?.sections[2]?.text ?? "";

    expect(
      OneOnOnePreparationReading.swotQuadrantsOf(swot)?.map((quadrante) => quadrante.title),
    ).toEqual(["Forças", "Fraquezas", "Oportunidades", "Ameaças"]);
    expect(OneOnOnePreparationReading.swotQuadrantsOf("Forças:\n– Só uma.")).toBeNull();
  });
});
