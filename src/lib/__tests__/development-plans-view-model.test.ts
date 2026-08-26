import { describe, expect, it, vi } from "vitest";

import type { DevelopmentPlan } from "../domain";
import type { Gap } from "../selectors";
import {
  DevelopmentPlansViewModel,
  type DevelopmentPlanService,
} from "../view-models/development-plans-view-model";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 60) — segundo ViewModel de tela desta fase, testado direto com um
 * `DevelopmentPlanService` falso (sem montar `useStore()`/React) — os
 * testes de componente existentes (`pdi-lifecycle.test.tsx`) já cobrem o
 * fim a fim via UI; estes cobrem a classe isolada.
 */
function fakeService(): DevelopmentPlanService & {
  updatePlanStatus: ReturnType<typeof vi.fn>;
  reopenPlan: ReturnType<typeof vi.fn>;
} {
  return {
    updatePlanStatus: vi.fn(
      async (planId: string, status: DevelopmentPlan["status"]) =>
        ({ id: planId, status }) as DevelopmentPlan,
    ),
    reopenPlan: vi.fn(
      async (planId: string) => ({ id: planId, status: "Approved" }) as DevelopmentPlan,
    ),
  };
}

const gap = (competencyId: string, value: number): Gap =>
  ({
    competency: { id: competencyId, name: competencyId } as Gap["competency"],
    item: { competencyId } as Gap["item"],
    gap: value,
    assessmentId: "assessment-1",
    targetSemantics: "NEXT_ROLE",
  }) as Gap;

describe("DevelopmentPlansViewModel", () => {
  describe("approve / complete / returnToDraft", () => {
    it("approve chama updatePlanStatus(planId, 'Approved')", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.approve("plano-1");
      expect(service.updatePlanStatus).toHaveBeenCalledWith("plano-1", "Approved");
    });

    it("complete chama updatePlanStatus(planId, 'Completed')", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.complete("plano-1");
      expect(service.updatePlanStatus).toHaveBeenCalledWith("plano-1", "Completed");
    });

    it("returnToDraft chama updatePlanStatus(planId, 'Draft')", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.returnToDraft("plano-1");
      expect(service.updatePlanStatus).toHaveBeenCalledWith("plano-1", "Draft");
    });

    it("propaga o erro do serviço — quem chama decide toast/mensagem", async () => {
      const service = fakeService();
      service.updatePlanStatus.mockRejectedValueOnce(new Error("409 conflito de versão"));
      const vm = new DevelopmentPlansViewModel(service);
      await expect(vm.approve("plano-1")).rejects.toThrow("409 conflito de versão");
    });
  });

  describe("reopen", () => {
    it("chama reopenPlan(planId, reason) e nunca updatePlanStatus", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.reopen("plano-1", "Encontrado erro na avaliação original");
      expect(service.reopenPlan).toHaveBeenCalledWith(
        "plano-1",
        "Encontrado erro na avaliação original",
      );
      expect(service.updatePlanStatus).not.toHaveBeenCalled();
    });
  });

  describe("suggestions", () => {
    const vm = new DevelopmentPlansViewModel(fakeService());

    it("exclui gaps que já viraram item do plano", () => {
      const gaps = [gap("a", 2), gap("b", 1)];
      const plan = { items: [{ competencyId: "a" }] } as unknown as DevelopmentPlan;
      expect(vm.suggestions(gaps, plan).map((g) => g.item.competencyId)).toEqual(["b"]);
    });

    it("sem plano (nenhum item ainda criado), nenhum gap é excluído", () => {
      const gaps = [gap("a", 2), gap("b", 1)];
      expect(vm.suggestions(gaps, undefined)).toHaveLength(2);
    });

    it("limita a 5 sugestões mesmo com mais gaps disponíveis", () => {
      const gaps = Array.from({ length: 8 }, (_, i) => gap(`c${i}`, 8 - i));
      expect(vm.suggestions(gaps, undefined)).toHaveLength(5);
    });
  });
});
