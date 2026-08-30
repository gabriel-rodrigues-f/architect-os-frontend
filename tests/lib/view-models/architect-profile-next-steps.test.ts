import { describe, expect, it, vi } from "vitest";

import { ArchitectProfileViewModel, type ArchitectProfileService } from "@/lib/view-models";

/**
 * FASE 2 (quinta rodada) — "perfil deveria ser o centro da jornada...
 * precisa priorizar pendências/próximo passo sobre inventário." Ver
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, Seção 7 e 33.
 *
 * R4 (varredura-oo-ddd-2026-08-29, §2c) — os próximos passos eram um
 * serviço de domínio exportado de um arquivo de ROTA, e este teste
 * importava a rota para alcançá-lo. A regra passou para a view-model do
 * perfil; as asserções abaixo são as mesmas, linha por linha.
 */
const fakeService = (): ArchitectProfileService => ({
  addEvidence: vi.fn(),
  resubmitEvidence: vi.fn(),
  reviewEvidence: vi.fn(),
});

const computeNextSteps: ArchitectProfileViewModel["nextSteps"] = (input) =>
  new ArchitectProfileViewModel(fakeService()).nextSteps(input);

describe("Workspace da pessoa — próximos passos", () => {
  const base = {
    canEditOwn: false,
    canReviewEvidence: false,
    itemsNotStartedCount: 0,
    gapsNotInPlanCount: 0,
    evidencesPendingCount: 0,
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

  it("sem canReviewEvidence, ignora evidência pendente e avaliação aguardando calibração", () => {
    const steps = computeNextSteps({
      ...base,
      evidencesPendingCount: 1,
      assessmentAwaitingCalibration: true,
    });
    expect(steps).toEqual([]);
  });

  it("com canReviewEvidence, lista evidência pendente e avaliação aguardando calibração", () => {
    const steps = computeNextSteps({
      ...base,
      canReviewEvidence: true,
      evidencesPendingCount: 1,
      assessmentAwaitingCalibration: true,
    });
    expect(steps).toEqual([{ kind: "evidencesPending", count: 1 }, { kind: "assessmentAwaiting" }]);
  });

  it("com as duas permissões, mistura os quatro tipos de passo", () => {
    const steps = computeNextSteps({
      canEditOwn: true,
      canReviewEvidence: true,
      itemsNotStartedCount: 1,
      gapsNotInPlanCount: 1,
      evidencesPendingCount: 1,
      assessmentAwaitingCalibration: true,
    });
    expect(steps.map((s) => s.kind)).toEqual([
      "itemsNotStarted",
      "gapsNotInPlan",
      "evidencesPending",
      "assessmentAwaiting",
    ]);
  });
});
