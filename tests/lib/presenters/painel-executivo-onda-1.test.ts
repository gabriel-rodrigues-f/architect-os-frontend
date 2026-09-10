import { describe, expect, it } from "vitest";

import type { AppState } from "@/lib/api";
import { DashboardPresenter } from "@/lib/presenters";
import { createSelectors } from "@/lib/selectors";
import { CoverageRuler, CriticalConcentrationRuler } from "@/lib/scoring-bands";
import { fixtureAssignedManagerUser, fixtureState, fixtureTeamId } from "../../helpers/fixtures";

/**
 * ONDA 1 do Painel Executivo (`direcao/painel-executivo-analise-2026-09-09.md`,
 * seção H) — os invariantes que a análise nomeou como defeito.
 *
 * Cada bloco abaixo é UM item da onda. Nenhum deles fala de tendência, seta
 * ou comparação entre ciclos: a análise mediu que com 7 pessoas comparáveis a
 * direção da seta inverte conforme a metodologia (seção G), e isso é onda 3.
 */

const presenterFor = (state: AppState) =>
  new DashboardPresenter(state, createSelectors(state), undefined, undefined);

/** As duas pessoas ativas do time da fixture, na ordem em que o roster as entrega. */
const timeDaFixture = (state: AppState) =>
  state.professionals.filter((professional) => professional.teamId === fixtureTeamId);

/**
 * ITEM 1 — o único KPI percentual da tela saía sem tom: 20% e 95% na mesma
 * cor, porque o padrão `neutral` tem estilo vazio (`KeyFigure.tsx`). Os
 * cortes NÃO são invenção: vêm da leitura da própria análise (D.2, KPI 1),
 * *"abaixo de 70%, o ciclo não foi lido e o resto do painel é amostra. Acima
 * de 90%, dá para decidir em cima dele."*
 */
describe("cobertura da avaliação tem faixa, não uma cor só", () => {
  it("abaixo de 70% o ciclo não foi lido", () => {
    expect(CoverageRuler.read(0).tone).toBe("critical");
    expect(CoverageRuler.read(0.2).tone).toBe("critical");
    expect(CoverageRuler.read(0.699).tone).toBe("critical");
  });

  it("de 70% a 90% a leitura é parcial", () => {
    expect(CoverageRuler.read(0.7).tone).toBe("high");
    expect(CoverageRuler.read(0.8).tone).toBe("high");
    expect(CoverageRuler.read(0.899).tone).toBe("high");
  });

  it("de 90% para cima dá para decidir em cima do painel", () => {
    expect(CoverageRuler.read(0.9).tone).toBe("ok");
    expect(CoverageRuler.read(0.95).tone).toBe("ok");
    expect(CoverageRuler.read(1).tone).toBe("ok");
  });

  it("20% e 95% não podem sair com o mesmo tom — é o defeito que a onda fecha", () => {
    expect(CoverageRuler.read(0.2).tone).not.toBe(CoverageRuler.read(0.95).tone);
  });
});

/**
 * ITEM 2 — `StatTones.bySeverity` devolvia "crítico" para QUALQUER contagem
 * acima de zero, então o cartão nunca deixava de estar vermelho, e uma cor
 * que nunca muda deixou de ser informação. A faixa passa a ler a PROPORÇÃO
 * de distâncias críticas sobre as distâncias abaixo do esperado — o mesmo
 * denominador que a legenda do cartão já publica.
 */
describe("concentração de distância crítica tem faixa, não binário", () => {
  it("nenhuma crítica é bom", () => {
    expect(CriticalConcentrationRuler.read(0, 40).tone).toBe("ok");
    expect(CriticalConcentrationRuler.read(0, 0).tone).toBe("ok");
  });

  it("uma cauda de críticas pede atenção, não alarme", () => {
    expect(CriticalConcentrationRuler.read(1, 40).tone).toBe("high");
    expect(CriticalConcentrationRuler.read(9, 40).tone).toBe("high");
  });

  it("um quarto ou mais do que está abaixo do esperado é crítico", () => {
    expect(CriticalConcentrationRuler.read(10, 40).tone).toBe("critical");
    expect(CriticalConcentrationRuler.read(30, 40).tone).toBe("critical");
  });

  it("1 de 40 e 30 de 40 não podem sair com o mesmo tom", () => {
    expect(CriticalConcentrationRuler.read(1, 40).tone).not.toBe(
      CriticalConcentrationRuler.read(30, 40).tone,
    );
  });
});

/**
 * ITEM 4 — o cartão "PDIs do ciclo" dividia populações diferentes: o
 * numerador contava planos de TODO o recorte entregue pela API (inclusive
 * pessoas desativadas e o próprio líder), o denominador contava só as pessoas
 * ativas sob liderança. Bastava uma pessoa desativada com PDI aprovado para
 * o cartão passar de 100%.
 */
describe("PDI do ciclo conta a mesma população no numerador e no denominador", () => {
  const planoDaAna = fixtureState.plans[0]!;

  const comPlanoDeQuemSaiuDoEscopo = (): AppState => ({
    ...fixtureState,
    professionals: [
      ...fixtureState.professionals,
      {
        ...fixtureState.professionals[0]!,
        id: "desativada",
        name: "Pessoa Desativada",
        email: "desativada@company.com",
        active: false,
      },
    ],
    plans: [
      { ...planoDaAna, id: "pdi-ana", status: "Approved" as const },
      {
        ...planoDaAna,
        id: "pdi-desativada",
        professionalId: "desativada",
        status: "Approved" as const,
      },
    ],
  });

  it("plano de pessoa fora da população não entra no numerador", () => {
    const state = comPlanoDeQuemSaiuDoEscopo();
    const presenter = presenterFor(state);
    const people = presenter.pendingQueuesFor(fixtureAssignedManagerUser).people;

    expect(presenter.approvedPlansOf(people).map((plan) => plan.id)).toEqual(["pdi-ana"]);
  });

  it("o numerador nunca passa do denominador", () => {
    const state = comPlanoDeQuemSaiuDoEscopo();
    const presenter = presenterFor(state);
    const people = presenter.pendingQueuesFor(fixtureAssignedManagerUser).people;

    expect(presenter.approvedPlansOf(people).length).toBeLessThanOrEqual(people.length);
  });

  it("uma pessoa com dois planos aprovados no ciclo conta uma vez", () => {
    const state: AppState = {
      ...fixtureState,
      plans: [
        { ...planoDaAna, id: "pdi-ana-1", status: "Approved" as const },
        { ...planoDaAna, id: "pdi-ana-2", status: "Approved" as const },
      ],
    };
    const presenter = presenterFor(state);
    const people = presenter.pendingQueuesFor(fixtureAssignedManagerUser).people;

    expect(presenter.approvedPlansOf(people)).toHaveLength(1);
  });
});

/**
 * ITEM 5 — os três blocos que já vinham de graça do servidor e a tela não
 * usava: `mentoringSessions` e `learningPaths` estão entre os nove conjuntos
 * que o Painel carrega desde sempre.
 *
 * A REGRA DO RETORNO, corrigida: a análise NÃO fala em prazo de 8 dias. Ela
 * diz *"pessoas cuja última sessão tem retorno marcado em data já passada"*,
 * e o "8, não 14" é a POPULAÇÃO medida no banco do dono (8 das 14 pessoas),
 * não um limiar. Não existe limiar de dias no código — não invento um.
 */
describe("os três sinais de acompanhamento que a tela já podia mostrar", () => {
  const HOJE = new Date("2026-09-09T12:00:00.000Z");

  const comSessoes = (sessions: AppState["mentoringSessions"]): AppState => ({
    ...fixtureState,
    mentoringSessions: sessions,
  });

  const sessao = (patch: Partial<AppState["mentoringSessions"][number]>) => ({
    id: "s1",
    mentor: "Líder",
    menteeId: "ana",
    date: "2026-07-08",
    durationMin: 60,
    topic: "1:1",
    notes: "",
    ...patch,
  });

  it("dias desde a última 1:1 é o máximo do time, e quem nunca teve 1:1 aparece sem número", () => {
    const state = comSessoes([sessao({ id: "s-ana", menteeId: "ana", date: "2026-07-08" })]);
    const presenter = presenterFor(state);
    const linhas = presenter.oneOnOneRecency(timeDaFixture(state), HOJE);

    expect(linhas.map((linha) => [linha.professional.id, linha.days])).toEqual([
      ["ana", 63],
      ["bruno", null],
    ]);
    expect(presenter.longestSinceOneOnOne(timeDaFixture(state), HOJE)).toBe(63);
  });

  it("retorno vencido é a ÚLTIMA sessão da pessoa com data de retorno já passada", () => {
    const state = comSessoes([
      sessao({
        id: "s-ana-antiga",
        menteeId: "ana",
        date: "2026-07-08",
        nextSession: "2026-08-01",
      }),
    ]);
    const presenter = presenterFor(state);

    expect(
      presenter
        .overdueFollowUps(timeDaFixture(state), HOJE)
        .map((linha) => [linha.professional.id, linha.dueOn]),
    ).toEqual([["ana", "2026-08-01"]]);
  });

  it("retorno no futuro não está vencido", () => {
    const state = comSessoes([
      sessao({ id: "s-ana", menteeId: "ana", date: "2026-09-01", nextSession: "2026-09-30" }),
    ]);
    expect(presenterFor(state).overdueFollowUps(timeDaFixture(state), HOJE)).toEqual([]);
  });

  it("sessão posterior ao retorno marcado apaga o vencimento — a conversa aconteceu", () => {
    const state = comSessoes([
      sessao({ id: "s-antiga", menteeId: "ana", date: "2026-07-08", nextSession: "2026-08-01" }),
      sessao({ id: "s-nova", menteeId: "ana", date: "2026-08-20" }),
    ]);
    expect(presenterFor(state).overdueFollowUps(timeDaFixture(state), HOJE)).toEqual([]);
  });

  it("trilha parada é a pessoa com trilha atribuída e nenhum item concluído", () => {
    const trilhaDaAna = fixtureState.learningPaths[0]!;
    const paradaState: AppState = {
      ...fixtureState,
      learningPaths: [
        {
          ...trilhaDaAna,
          progress: trilhaDaAna.progress.map((entry) => ({
            ...entry,
            status: "In Progress" as const,
          })),
        },
      ],
    };

    expect(
      presenterFor(paradaState)
        .stalledPaths(timeDaFixture(paradaState))
        .map((linha) => [linha.professional.id, linha.path.id]),
    ).toEqual([["ana", "lp-sec"]]);

    // A fixture original tem um item concluído: a trilha da Ana andou.
    expect(presenterFor(fixtureState).stalledPaths(timeDaFixture(fixtureState))).toEqual([]);
  });
});

/**
 * ITEM 6 — "21 distâncias críticas na organização" escondia que 100% delas
 * estavam em duas pessoas. O agregado apaga a única informação útil, que são
 * os nomes.
 */
describe("distância crítica sai em nomes, não só em agregado", () => {
  const comCriticasDesiguais = (): AppState => ({
    ...fixtureState,
    assessments: fixtureState.assessments.map((assessment) =>
      assessment.professionalId === "bruno"
        ? {
            ...assessment,
            items: assessment.items.map((item) => ({
              ...item,
              final: 1 as const,
              target: 5 as const,
            })),
          }
        : assessment,
    ),
  });

  it("lista quem tem distância crítica, com a contagem de cada um, do maior para o menor", () => {
    const state = comCriticasDesiguais();
    const presenter = presenterFor(state);
    const linhas = presenter.criticalGapsByProfessional(timeDaFixture(state));

    expect(linhas.map((linha) => linha.professional.id)).toEqual(["bruno"]);
    expect(linhas[0]!.count).toBe(presenter.criticalGapCount(timeDaFixture(state)));
  });

  it("quem não tem distância crítica não aparece na lista", () => {
    const state = comCriticasDesiguais();
    const presenter = presenterFor(state);
    const nomes = presenter.criticalGapsByProfessional(timeDaFixture(state));
    expect(nomes.every((linha) => linha.count > 0)).toBe(true);
  });

  it("sem nenhuma distância crítica, a lista é vazia", () => {
    const presenter = presenterFor(fixtureState);
    expect(presenter.criticalGapsByProfessional(timeDaFixture(fixtureState))).toEqual([]);
  });
});

/**
 * ITEM 8 — os dois métodos mortos do apresentador. `pathsInProgress` não tem
 * nenhuma referência em `src/`; `topGaps` só era exercitado pelo próprio
 * teste unitário, com um algoritmo de seleção de 31 linhas que nenhuma tela
 * chamava. Esta régua guarda o dia em que alguém os trouxer de volta sem
 * chamador.
 */
describe("o apresentador não guarda método sem chamador", () => {
  it("pathsInProgress e topGaps não existem mais", () => {
    const presenter = presenterFor(fixtureState) as unknown as Record<string, unknown>;
    expect("topGaps" in presenter).toBe(false);
    expect("pathsInProgress" in presenter).toBe(false);
  });
});
