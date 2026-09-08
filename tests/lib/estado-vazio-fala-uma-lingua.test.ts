import { describe, expect, it } from "vitest";

import { EmptySubject } from "@/lib/empty-subject";
import { interpolate, type MessageKey } from "@/lib/i18n";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * A RÉGUA DO TÍTULO — a linha 1 de todo estado vazio.
 *
 * Dono (2026-09-08, item 3): a primeira linha misturava "Nenhum…",
 * "Nenhuma…", "Não há…" e "…disponível", porque cada tela a escrevia à mão.
 * Passa a valer UM formato — `Nenhum {assunto} cadastrado` / `Nenhuma
 * {assunto} cadastrada` — com a concordância vinda do PRÓPRIO assunto, sem
 * ponto final.
 *
 * Esta suíte é a régua do formato, e ela mora aqui e não nas telas: se a
 * frase de um assunto sair do molde, é este teste que fica vermelho — não
 * doze testes de tela.
 */
type Catalogo = Record<string, string>;

const tradutorDe =
  (catalogo: Catalogo) =>
  (chave: MessageKey, params?: Record<string, string | number>): string =>
    interpolate(catalogo[chave] ?? chave, params);

const emPt = tradutorDe(pt as Catalogo);
const emEn = tradutorDe(en as Catalogo);

/** "Nenhum profissional cadastrado" — masculino; nada além disso passa. */
const MASCULINO = /^Nenhum (?!há\b)[a-zà-ú][a-zà-ú\s]*[a-zà-ú] cadastrado$/;
/** "Nenhuma capacidade cadastrada" — feminino. */
const FEMININO = /^Nenhuma [a-zà-ú][a-zà-ú\s]*[a-zà-ú] cadastrada$/;

describe("a linha 1 tem um formato só, e a concordância vem do assunto", () => {
  for (const assunto of EmptySubject.ALL) {
    it(`${assunto.name}: casa o molde do gênero declarado`, () => {
      const titulo = assunto.title(emPt);
      const molde = assunto.gender === "masculino" ? MASCULINO : FEMININO;
      expect(titulo, `${assunto.name}: "${titulo}"`).toMatch(molde);
    });

    it(`${assunto.name}: nada de "Não há…", "…disponível" ou ponto final`, () => {
      const titulo = assunto.title(emPt);
      expect(titulo.startsWith("Não há")).toBe(false);
      expect(titulo).not.toContain("disponível");
      expect(titulo.endsWith(".")).toBe(false);
    });

    it(`${assunto.name}: o inglês diz o mesmo par, no molde dele`, () => {
      expect(assunto.title(emEn)).toMatch(/^No [a-z][a-z\s]*[a-z] registered$/);
    });

    it(`${assunto.name}: o substantivo existe nas duas línguas`, () => {
      expect(typeof (pt as Catalogo)[assunto.nounKey]).toBe("string");
      expect(typeof (en as Catalogo)[assunto.nounKey]).toBe("string");
    });
  }

  it("os seis assuntos ditados pelo dono estão no objeto, com o gênero dele", () => {
    const generos = Object.fromEntries(
      EmptySubject.ALL.map((assunto) => [assunto.name, assunto.gender]),
    );
    expect(generos).toMatchObject({
      professional: "masculino",
      capability: "feminino",
      competency: "feminino",
      learningPath: "feminino",
      cycle: "masculino",
      team: "masculino",
    });
  });

  /**
   * A PROVA DO VERMELHO: as frases que a aplicação dizia até 2026-09-08 —
   * cada uma de uma tela — são exatamente as que o molde recusa.
   */
  it("as frases antigas não passam pelo molde", () => {
    const antigas = [
      "Não há profissionais cadastrados",
      "Não há ciclos cadastrados",
      "Nenhum ciclo disponível",
      "Nenhum time disponível para configurar.",
      "Não há o que avaliar ainda",
      "Nenhuma capacidade cadastrada.",
    ];
    for (const frase of antigas) {
      expect(MASCULINO.test(frase) || FEMININO.test(frase), frase).toBe(false);
    }
  });

  it("as frases de hoje passam", () => {
    expect("Nenhum profissional cadastrado").toMatch(MASCULINO);
    expect("Nenhum nível de carreira cadastrado").toMatch(MASCULINO);
    expect("Nenhuma trilha cadastrada").toMatch(FEMININO);
  });

  /** O molde não é escrito duas vezes: é UMA chave por gênero, e só. */
  it("o molde mora numa chave por gênero, com o marcador do assunto", () => {
    expect((pt as Catalogo)["empty.title.masculine"]).toBe("Nenhum {assunto} cadastrado");
    expect((pt as Catalogo)["empty.title.feminine"]).toBe("Nenhuma {assunto} cadastrada");
  });

  /**
   * O catálogo inteiro, não só os assuntos: nenhuma chave de estado vazio
   * pode voltar a dizer "Não há … cadastrad*" ou "… disponível" ao lado de
   * "Nenhum". A régua é do TEXTO porque foi o texto que divergiu.
   */
  it("nenhuma chave do catálogo volta ao vocabulário antigo do vazio", () => {
    const reincidentes = Object.entries(pt as Catalogo)
      .filter(([, texto]) => /^Não há .*cadastrad[oa]s?\.?$/.test(texto))
      .map(([chave]) => chave);
    expect(reincidentes).toEqual([]);
  });
});
