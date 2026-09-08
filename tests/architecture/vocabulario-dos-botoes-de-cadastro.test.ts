import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * O VOCABULÁRIO DOS BOTÕES, TELA A TELA — pedido literal do dono (2026-09-08).
 *
 * Ele leu as onze telas em voz alta e ditou o rótulo de cada botão de criar:
 * "Cadastrar Profissional", "Cadastrar Trilha", "Cadastrar Ciclo",
 * "Cadastrar Capacidade", "Cadastrar Time". O verbo é sempre CADASTRAR — não
 * "Novo", não "Criar" —, e o complemento é a coisa do negócio, não a tela.
 *
 * Esta rede é de TEXTO, e é de propósito: o que quebrou antes não foi o
 * componente (esse já é um só, o `PageAction`), foi a palavra — cada tela
 * escolhia a sua. A prova do desenho vive nos testes de componente; a prova
 * da PALAVRA vive aqui, onde ela é escrita uma vez para as duas línguas.
 */
type Catalogo = Record<string, string>;

const catalogos = { pt: pt as Catalogo, en: en as Catalogo };

const ROTULOS: { chave: string; pt: string; en: string; tela: string }[] = [
  {
    tela: "Talentos do Time",
    chave: "team.empty.cta",
    pt: "Cadastrar Profissional",
    en: "Register Professional",
  },
  {
    tela: "Trilhas de Aprendizagem",
    chave: "path.new.placeholder",
    pt: "Cadastrar Trilha",
    en: "Register Path",
  },
  { tela: "Ciclos de Avaliação", chave: "cycle.new", pt: "Cadastrar Ciclo", en: "Register Cycle" },
  {
    tela: "Catálogo de Competências",
    chave: "matrix.newCapability",
    pt: "Cadastrar Capacidade",
    en: "Register Capability",
  },
  {
    tela: "Estrutura de Times",
    chave: "teams.create.action",
    pt: "Cadastrar Time",
    en: "Register Team",
  },
  {
    tela: "Contas e Acessos",
    chave: "users.admit.action",
    pt: "Cadastrar Profissional",
    en: "Register Professional",
  },
];

const raizDoFrontend = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fonte = (caminho: string): string =>
  readFileSync(join(raizDoFrontend, "src", caminho), "utf8");

describe("o botão de cadastrar diz a mesma coisa em toda tela", () => {
  for (const { tela, chave, pt: emPt, en: emEn } of ROTULOS) {
    it(`${tela}: "${emPt}" / "${emEn}"`, () => {
      expect(catalogos.pt[chave]).toBe(emPt);
      expect(catalogos.en[chave]).toBe(emEn);
    });
  }

  it("nenhum rótulo de criação sobrou no vocabulário antigo", () => {
    const antigos = [
      "Nova trilha",
      "Novo ciclo",
      "Nova capacidade",
      "Criar time",
      "Cadastrar pessoa",
    ];
    const sobrando = Object.entries(catalogos.pt)
      .filter(([, texto]) => antigos.includes(texto))
      .map(([chave]) => chave);
    expect(sobrando).toEqual([]);
  });
});

/**
 * Item 5 do dono: *"o nome da tela vira 'Plano de Desenvolvimento
 * Individual' (hoje 'Plano Individual de Desenvolvimento'), em pt e en, no
 * menu, no título e onde mais aparecer"*. O nome vive em quatro chaves e na
 * aba do navegador — e é UM nome só, como manda `uma-tela-um-nome`.
 */
describe("o PDI se chama Plano de Desenvolvimento Individual", () => {
  const CHAVES = [
    "nav.developmentPlans",
    "pdi.title",
    "help.developmentPlans.lead.title",
    "help.developmentPlans.member.title",
  ];

  it("um nome só, em pt, nas quatro chaves", () => {
    const nomes = CHAVES.map((chave) => catalogos.pt[chave]);
    expect(new Set(nomes).size).toBe(1);
    expect(nomes[0]).toBe("Plano de Desenvolvimento Individual (PDI)");
  });

  it("a ordem antiga das palavras não sobrou em lugar nenhum do catálogo", () => {
    const sobrando = Object.entries(catalogos.pt)
      .filter(([, texto]) => texto.includes("Plano Individual de Desenvolvimento"))
      .map(([chave]) => chave);
    expect(sobrando).toEqual([]);
  });

  it("a aba do navegador usa o mesmo nome", () => {
    expect(fonte("routes/development-plans.tsx")).toContain(
      "Plano de Desenvolvimento Individual (PDI) — Synapse",
    );
    expect(fonte("routes/development-plans.tsx")).not.toContain(
      "Plano Individual de Desenvolvimento",
    );
  });
});

/**
 * Item 7: *"Ciclos de Avaliação — SAI o botão do centro da tela"*. Sobrou UMA
 * ação de cadastrar ciclo, a do canto; o corpo vazio explica e não repete o
 * botão.
 */
describe("Ciclos de Avaliação tem uma ação de cadastro, não duas", () => {
  it("a tela declara um `PageAction` só", () => {
    const ocorrencias = fonte("routes/cycles.tsx").match(/<PageAction\b/g) ?? [];
    expect(ocorrencias).toHaveLength(1);
  });
});
