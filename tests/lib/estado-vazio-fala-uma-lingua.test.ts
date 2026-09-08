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
 *
 * NEM TODO VAZIO É DE CADASTRO (dono, 2026-09-08): *"precisamos corrigir o
 * texto do Extrato para 'Nenhum evento no período'. Verifique se há mais
 * telas × perfis despadronizados. Sempre vamos utilizar, havendo algo vazio
 * no centro da tela, 'Nenhum {alguma coisa} {contexto}'."* Então a régua
 * ganhou um segundo molde (`titleIn`) e, no fim do arquivo, a CATRACA DO
 * VOCABULÁRIO DO VAZIO: piso declarado para o que ainda começa com "Sem ",
 * e piso ZERO para o centro da tela.
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

/**
 * O SEGUNDO MOLDE — o vazio que não é de cadastro. "Nenhum evento no
 * período", "Nenhuma avaliação neste ciclo", "Nenhum nível registrado neste
 * ciclo": o assunto continua escolhendo a concordância, e o CONTEXTO é sempre
 * outra chave de texto — nunca uma frase escrita na tela.
 */
const MASCULINO_EM_CONTEXTO = /^Nenhum (?!há\b)[a-zà-ú].*[a-zà-ú]$/;
const FEMININO_EM_CONTEXTO = /^Nenhuma [a-zà-ú].*[a-zà-ú]$/;

/** Os contextos declarados hoje — a régua varre todos, sem lista paralela na tela. */
const CONTEXTOS: readonly MessageKey[] = [
  "empty.context.inPeriod",
  "empty.context.inThisCycle",
  "empty.context.recorded",
  "empty.context.official",
  "empty.context.toCompare",
  "empty.context.previousToCompare",
  "empty.context.inYourScope",
  "empty.context.selected",
  "empty.context.completedToCompare",
];

describe("o vazio que não é de cadastro: Nenhum(a) {assunto} {contexto}", () => {
  for (const assunto of EmptySubject.EVERY) {
    for (const contexto of CONTEXTOS) {
      it(`${assunto.name} × ${contexto}: casa o molde do gênero, sem ponto final`, () => {
        const titulo = assunto.titleIn(emPt, contexto);
        const molde = assunto.gender === "masculino" ? MASCULINO_EM_CONTEXTO : FEMININO_EM_CONTEXTO;
        expect(titulo, `${assunto.name}/${contexto}: "${titulo}"`).toMatch(molde);
        expect(titulo.endsWith(".")).toBe(false);
        expect(titulo).not.toContain("{");
      });
    }
  }

  it("o molde do contexto mora numa chave por gênero, com os dois marcadores", () => {
    expect((pt as Catalogo)["empty.title.masculine.context"]).toBe("Nenhum {assunto} {contexto}");
    expect((pt as Catalogo)["empty.title.feminine.context"]).toBe("Nenhuma {assunto} {contexto}");
  });

  it("todo assunto e todo contexto existem nas duas línguas", () => {
    for (const assunto of EmptySubject.EVERY) {
      expect(typeof (en as Catalogo)[assunto.nounKey], assunto.name).toBe("string");
    }
    for (const contexto of CONTEXTOS) {
      expect(typeof (pt as Catalogo)[contexto], contexto).toBe("string");
      expect(typeof (en as Catalogo)[contexto], contexto).toBe("string");
    }
  });
});

/**
 * A CATRACA DO VOCABULÁRIO DO VAZIO (dono, 2026-09-08).
 *
 * As chaves abaixo são o PISO DECLARADO: o que ainda começa com "Sem " no
 * catálogo, e que não é vazio do centro da tela — rótulo de opção de filtro
 * ("Sem time"), selo de tabela ("Sem dados"), prosa de ajuda. A lista só
 * ENCOLHE: uma chave nova que comece com "Sem " deixa o gate vermelho, e uma
 * que saia daqui e continue na lista também.
 *
 * O que NÃO tem piso é o centro da tela: ali o piso é ZERO, e quem o guarda é
 * a segunda regra — todo `<EmptyState title={t("chave")}>` tem de apontar
 * para um texto no molde `Nenhum(a) …`.
 */
const PISO_DO_SEM: readonly string[] = [
  "ai.suggestion.absences",
  "cap.empty.noScope.hint",
  "cap.notAssessed.list",
  "cap.risk.badge.insufficientData",
  "cap.risk.badge.noReference",
  "cap.risk.noReference",
  "cap.table.col.notAssessed",
  "config.operational.idleTimeoutImpact",
  "dash.help.leadEvidence.how",
  "level.scale.none",
  "mentor.followUp.none",
  "roadmap.semRegua.hint",
  "seniority.absent",
  "team.filter.capability.none",
  "team.transition.noTeam",
  "users.filter.team.none",
];

describe("catraca do vocabulário do vazio", () => {
  const comecamComSem = Object.entries(pt as Catalogo)
    .filter(([, texto]) => texto.startsWith("Sem "))
    .map(([chave]) => chave)
    .sort();

  it("nenhuma chave NOVA começa com 'Sem '", () => {
    expect(comecamComSem.filter((chave) => !PISO_DO_SEM.includes(chave))).toEqual([]);
  });

  it("o piso só desce: chave que saiu do 'Sem ' não fica pendurada na lista", () => {
    expect(PISO_DO_SEM.filter((chave) => !comecamComSem.includes(chave))).toEqual([]);
  });

  /**
   * O CENTRO DA TELA tem piso ZERO. Varre o `src/` atrás de
   * `<EmptyState title={t("chave")}` e exige que o texto daquela chave esteja
   * no molde — é assim que "Sem eventos no período" não volta pela porta de
   * uma tela nova. Título COMPOSTO (`EmptySubject…title*(t, …)`) não entra na
   * varredura porque já nasce no molde, por construção.
   */
  /**
   * O que a varredura encontra e NÃO é vazio do centro da tela. Cada linha é
   * uma decisão, não uma dispensa: telas de RECUSA (o alcance negado) e
   * estados POSITIVOS (o topo da escada, "nada faltando") usam o mesmo bloco
   * visual e não descrevem coisa nenhuma que esteja faltando. A lista é
   * declarada e só encolhe — o teste abaixo cobra que ela não guarde chave
   * que já entrou no molde.
   */
  const FORA_DA_REGUA_DO_VAZIO: readonly string[] = [
    // Recusa de alcance: não é vazio, é porta fechada.
    "calibration.restricted",
    "teamRules.leadOnly",
    "teams.restricted",
    // Estados positivos: não falta nada, e é isso que a frase diz.
    "roadmap.top.title",
    "roadmap.coverage.nothingMissing",
  ];

  it("todo título de estado vazio do centro da tela está no molde 'Nenhum(a) …'", async () => {
    const { Varredura } = await import("../helpers/catraca");
    const foraDoMolde: string[] = [];
    new Varredura().contagem((arquivo) => {
      for (const bloco of arquivo.conteudo.match(/<EmptyState[\s\S]{0,400}?\/>/g) ?? []) {
        const chave = /title=\{t\("([^"]+)"/.exec(bloco)?.[1];
        if (chave === undefined) continue;
        const frase = (pt as Catalogo)[chave];
        if (FORA_DA_REGUA_DO_VAZIO.includes(chave)) continue;
        if (frase !== undefined && !/^Nenhum(a)? /.test(frase)) {
          foraDoMolde.push(`${arquivo.chave}: ${chave} = "${frase}"`);
        }
      }
      return 0;
    });
    expect(foraDoMolde).toEqual([]);
  });

  it("a lista de exceções só encolhe: chave que entrou no molde sai dela", () => {
    const jaNoMolde = FORA_DA_REGUA_DO_VAZIO.filter((chave) =>
      /^Nenhum(a)? /.test((pt as Catalogo)[chave] ?? ""),
    );
    expect(jaNoMolde).toEqual([]);
  });
});
