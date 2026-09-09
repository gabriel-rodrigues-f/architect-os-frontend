import { describe, expect, it } from "vitest";

import { professionalProfileViewModel } from "@/lib/view-models";

/**
 * FASE 2 (quinta rodada) — "perfil deveria ser o centro da jornada...
 * precisa priorizar pendências/próximo passo sobre inventário." Ver
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, Seção 7 e 33.
 *
 * R4 (varredura-oo-ddd-2026-08-29, §2c) — os próximos passos eram um
 * serviço de domínio exportado de um arquivo de ROTA, e este teste
 * importava a rota para alcançá-lo. A regra passou para a view-model do
 * perfil; as asserções abaixo são as mesmas, linha por linha.
 *
 * 2026-09-08 (regra 17) — a evidência saiu do produto, e com ela o passo
 * "evidências aguardando revisão". O passo da avaliação esperando calibração
 * dividia a MESMA guarda com ele: se a guarda saísse junto, a calibração
 * sumiria da tela sem erro de tipo e sem teste vermelho. Por isso cada passo
 * agora declara a sua própria guarda, e os dois casos abaixo — "sem
 * leadsProfessional" e "com leadsProfessional" — existem para fixar que a
 * calibração continua de pé por conta própria.
 */
const computeNextSteps = professionalProfileViewModel.nextSteps.bind(professionalProfileViewModel);

describe("Workspace da pessoa — próximos passos", () => {
  const base = {
    canEditOwn: false,
    leadsProfessional: false,
    itemsNotStartedCount: 0,
    gapsNotInPlanCount: 0,
    assessmentAwaitingCalibration: false,
  };

  it("sem nenhum sinal, devolve lista vazia", () => {
    expect(computeNextSteps(base)).toEqual([]);
  });

  it("sem canEditOwn, ignora itens Not Started e gaps fora do PDI mesmo que existam", () => {
    const steps = computeNextSteps({
      ...base,
      itemsNotStartedCount: 3,
      gapsNotInPlanCount: 2,
    });
    expect(steps).toEqual([]);
  });

  it("com canEditOwn, lista itens Not Started e gaps fora do PDI, nesta ordem", () => {
    const steps = computeNextSteps({
      ...base,
      canEditOwn: true,
      itemsNotStartedCount: 3,
      gapsNotInPlanCount: 2,
    });
    expect(steps).toEqual([
      { kind: "itemsNotStarted", count: 3 },
      { kind: "gapsNotInPlan", count: 2 },
    ]);
  });

  it("sem leadsProfessional, ignora a avaliação aguardando calibração", () => {
    const steps = computeNextSteps({ ...base, assessmentAwaitingCalibration: true });
    expect(steps).toEqual([]);
  });

  it("quem lidera vê a avaliação aguardando calibração mesmo sem nada a editar", () => {
    const steps = computeNextSteps({
      ...base,
      leadsProfessional: true,
      assessmentAwaitingCalibration: true,
    });
    expect(steps).toEqual([{ kind: "assessmentAwaiting" }]);
  });

  it("com as duas guardas, mistura os três tipos de passo", () => {
    const steps = computeNextSteps({
      canEditOwn: true,
      leadsProfessional: true,
      itemsNotStartedCount: 1,
      gapsNotInPlanCount: 1,
      assessmentAwaitingCalibration: true,
    });
    expect(steps.map((s) => s.kind)).toEqual([
      "itemsNotStarted",
      "gapsNotInPlan",
      "assessmentAwaiting",
    ]);
  });
});
