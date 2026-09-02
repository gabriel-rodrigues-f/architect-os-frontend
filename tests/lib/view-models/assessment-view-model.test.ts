import { describe, expect, it, vi } from "vitest";

import type { Architect, Assessment, AssessmentEligibility, Capability } from "@/lib/domain";
import { UiAuthorizationPolicy } from "@/lib/scope";
import {
  AssessmentViewModel,
  type AssessmentItemService,
  type AssessmentPortfolioService,
} from "@/lib/view-models";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — quarto ViewModel de tela desta fase, testado direto com
 * dois serviços falsos (sem montar `useStore()`/React), no mesmo espírito
 * de `team-view-model.test.ts`/`development-plans-view-model.test.ts`: a
 * cobertura de componente (assessment-comments/assessments-portfolio/
 * assessment-development-summary/assessment-lifecycle.test.tsx) já exercita
 * o fim a fim via UI; estes cobrem a classe isolada.
 */

function fakeItemService(): AssessmentItemService & {
  updateAssessmentItem: ReturnType<typeof vi.fn>;
  addAssessmentComment: ReturnType<typeof vi.fn>;
  updateAssessmentComment: ReturnType<typeof vi.fn>;
  removeAssessmentComment: ReturnType<typeof vi.fn>;
} {
  return {
    updateAssessmentItem: vi.fn(),
    addAssessmentComment: vi.fn(async () => ({}) as Assessment),
    updateAssessmentComment: vi.fn(async () => ({}) as Assessment),
    removeAssessmentComment: vi.fn(async () => ({}) as Assessment),
  };
}

function fakePortfolioService(): AssessmentPortfolioService & {
  addAssessmentCapability: ReturnType<typeof vi.fn>;
  removeAssessmentCapability: ReturnType<typeof vi.fn>;
  confirmAssessmentCapability: ReturnType<typeof vi.fn>;
  updateAssessmentDevelopmentSummary: ReturnType<typeof vi.fn>;
} {
  return {
    addAssessmentCapability: vi.fn(async () => ({}) as never),
    removeAssessmentCapability: vi.fn(async () => undefined),
    confirmAssessmentCapability: vi.fn(async () => ({}) as never),
    updateAssessmentDevelopmentSummary: vi.fn(async () => ({}) as never),
  };
}

const baseAssessment: Assessment = {
  id: "asmt-1",
  architectId: "ana",
  cycleId: "2026-h2",
  status: "Draft",
  modelVersion: 2,
  targetCareerLevelId: null,
  targetSemantics: "NEXT_ROLE",
  version: 1,
  items: [],
};

const anaArchitect: Architect = {
  id: "ana",
  name: "Ana Martins",
  role: "Júnior",
  yearsAsArchitect: 2,
  specialization: "",
  email: "ana@company.com",
  active: true,
  teamId: "time-plataforma",
  version: 1,
};

function makeVm(item = fakeItemService(), portfolio = fakePortfolioService()) {
  return {
    vm: new AssessmentViewModel(item, portfolio, new UiAuthorizationPolicy()),
    item,
    portfolio,
  };
}

describe("AssessmentViewModel", () => {
  describe("permissionsFor", () => {
    it("dono em Draft: canEditSelf/canSubmit, nunca isLead mesmo se a conta também lidera", () => {
      const { vm } = makeVm();
      const ownerAsLeadToo = { ...fixtureMemberUser, role: "tech_lead" as const };
      const result = vm.permissionsFor(ownerAsLeadToo, "ana", anaArchitect, baseAssessment);
      expect(result.isOwner).toBe(true);
      expect(result.isLead).toBe(false);
      expect(result.canEditSelf).toBe(true);
      expect(result.canSubmit).toBe(true);
      expect(result.canEditLeaderFinal).toBe(false);
    });

    it("Tech Lead responsável em In Review: canEditLeaderFinal/canComplete", () => {
      const { vm } = makeVm();
      const assessment = { ...baseAssessment, status: "In Review" as const };
      const result = vm.permissionsFor(
        fixtureUnassignedTechLeadUser,
        "ana",
        anaArchitect,
        assessment,
      );
      expect(result.isOwner).toBe(false);
      expect(result.isLead).toBe(true);
      expect(result.canEditLeaderFinal).toBe(true);
      expect(result.canComplete).toBe(true);
      expect(result.canEditSelf).toBe(false);
    });

    it("lead sobre arquiteto SEM TIME não ganha canEditLeaderFinal — UX-001 pós-Fase 2 (vínculo é o time; lead de outro time nem recebe a pessoa no recorte do servidor)", () => {
      const { vm } = makeVm();
      const teamlessAna = { ...anaArchitect, teamId: null };
      const assessment = { ...baseAssessment, status: "In Review" as const };
      const result = vm.permissionsFor(
        fixtureUnassignedTechLeadUser,
        "ana",
        teamlessAna,
        assessment,
      );
      expect(result.isLead).toBe(false);
      expect(result.canEditLeaderFinal).toBe(false);
    });

    it("admin conta como lead (bypass do isLeadOf), mas nunca como dono de quem não é", () => {
      const { vm } = makeVm();
      const assessment = { ...baseAssessment, status: "In Review" as const };
      const result = vm.permissionsFor(fixtureAdminUser, "ana", anaArchitect, assessment);
      expect(result.isOwner).toBe(false);
      expect(result.isLead).toBe(true);
      expect(result.canEditLeaderFinal).toBe(true);
    });

    it("Completed: canReopen só para o Tech Lead responsável", () => {
      const { vm } = makeVm();
      const assessment = { ...baseAssessment, status: "Completed" as const };
      const result = vm.permissionsFor(
        fixtureUnassignedTechLeadUser,
        "ana",
        anaArchitect,
        assessment,
      );
      expect(result.isCompleted).toBe(true);
      expect(result.canReopen).toBe(true);
      expect(result.canEditSelf).toBe(false);
      expect(result.canEditLeaderFinal).toBe(false);
    });

    it("incompleteSelf/incompleteLeaderFinal refletem os itens do assessment", () => {
      const { vm } = makeVm();
      const assessment: Assessment = {
        ...baseAssessment,
        items: [
          {
            competencyId: "c1",
            self: null,
            leader: 3,
            target: 4,
            final: null,
            comments: [],
          },
        ],
      };
      const result = vm.permissionsFor(fixtureMemberUser, "ana", anaArchitect, assessment);
      expect(result.incompleteSelf).toBe(true);
      expect(result.incompleteLeaderFinal).toBe(true);
    });

    it("sem assessment (ainda não aberto), nada trava por item incompleto e status é undefined", () => {
      const { vm } = makeVm();
      const result = vm.permissionsFor(fixtureMemberUser, "ana", anaArchitect, undefined);
      expect(result.status).toBeUndefined();
      expect(result.incompleteSelf).toBe(false);
      expect(result.incompleteLeaderFinal).toBe(false);
      expect(result.canSubmit).toBe(false);
    });
  });

  describe("updateSelfScore / updateLeaderScore / updateFinalScore", () => {
    it("cada método grava só o próprio campo, nunca os outros dois", () => {
      const { vm, item } = makeVm();
      vm.updateSelfScore("asmt-1", "c1", 3);
      expect(item.updateAssessmentItem).toHaveBeenCalledWith("asmt-1", "c1", { self: 3 });

      vm.updateLeaderScore("asmt-1", "c1", 4);
      expect(item.updateAssessmentItem).toHaveBeenCalledWith("asmt-1", "c1", { leader: 4 });

      vm.updateFinalScore("asmt-1", "c1", 5);
      expect(item.updateAssessmentItem).toHaveBeenCalledWith("asmt-1", "c1", { final: 5 });

      expect(item.updateAssessmentItem).toHaveBeenCalledTimes(3);
    });
  });

  describe("comentários", () => {
    it("addComment/updateComment/removeComment delegam 1:1 para o serviço de item", async () => {
      const { vm, item } = makeVm();

      await vm.addComment("asmt-1", "c1", { text: "olá" });
      expect(item.addAssessmentComment).toHaveBeenCalledWith("asmt-1", "c1", { text: "olá" });

      await vm.updateComment("asmt-1", "c1", "com-1", { text: "editado" });
      expect(item.updateAssessmentComment).toHaveBeenCalledWith("asmt-1", "c1", "com-1", {
        text: "editado",
      });

      await vm.removeComment("asmt-1", "c1", "com-1");
      expect(item.removeAssessmentComment).toHaveBeenCalledWith("asmt-1", "c1", "com-1");
    });

    it("propaga o erro do serviço — quem chama decide a mensagem", async () => {
      const item = fakeItemService();
      item.addAssessmentComment.mockRejectedValueOnce(new Error("texto vazio"));
      const { vm } = makeVm(item);
      await expect(vm.addComment("asmt-1", "c1", { text: "" })).rejects.toThrow("texto vazio");
    });
  });

  describe("portfólio de capacidades", () => {
    it("proposeCapability chama addAssessmentCapability", async () => {
      const { vm, portfolio } = makeVm();
      await vm.proposeCapability("asmt-1", "cloud");
      expect(portfolio.addAssessmentCapability).toHaveBeenCalledWith("asmt-1", "cloud");
    });

    it("confirmCapability chama confirmAssessmentCapability", async () => {
      const { vm, portfolio } = makeVm();
      await vm.confirmCapability("asmt-1", "cloud");
      expect(portfolio.confirmAssessmentCapability).toHaveBeenCalledWith("asmt-1", "cloud");
    });

    it("removeCapability sem force nasce false — só entra true quando quem chama pede explicitamente", async () => {
      const { vm, portfolio } = makeVm();
      await vm.removeCapability("asmt-1", "cloud");
      expect(portfolio.removeAssessmentCapability).toHaveBeenCalledWith("asmt-1", "cloud", false);

      await vm.removeCapability("asmt-1", "cloud", true);
      expect(portfolio.removeAssessmentCapability).toHaveBeenCalledWith("asmt-1", "cloud", true);
    });

    it("propaga o erro (ex.: 409 PORTFOLIO_HAS_ANSWERED_ITEMS) — quem chama decide o diálogo", async () => {
      const portfolio = fakePortfolioService();
      portfolio.removeAssessmentCapability.mockRejectedValueOnce(new Error("409 conflito"));
      const { vm } = makeVm(fakeItemService(), portfolio);
      await expect(vm.removeCapability("asmt-1", "cloud")).rejects.toThrow("409 conflito");
    });
  });

  describe("availableCapabilitiesToPropose", () => {
    const readyCap = (id: string): Capability => ({
      id,
      name: id,
      short: id,
      active: true,
      curation: {
        activeCompetencyCount: 6,
        status: "READY",
      },
    });
    const curatingCap = (id: string): Capability => ({
      id,
      name: id,
      short: id,
      active: true,
      curation: {
        activeCompetencyCount: 2,
        status: "REQUIRES_CURATION",
      },
    });
    const eligibility = (ids: string[]): AssessmentEligibility => ({
      currentCareerLevel: undefined,
      nextCareerLevel: undefined,
      policy: undefined,
      capabilities: ids.map((capabilityId) => ({
        capabilityId,
        confirmed: false,
        qualified: false,
      })),
      qualifiedConfirmedCount: 0,
      eligible: null,
    });

    it("só oferece capacidade READY", () => {
      const { vm } = makeVm();
      const result = vm.availableCapabilitiesToPropose(
        [readyCap("cloud"), curatingCap("security")],
        eligibility([]),
      );
      expect(result.map((c) => c.id)).toEqual(["cloud"]);
    });

    it("exclui capacidade já no portfólio do assessment, mesmo estando READY", () => {
      const { vm } = makeVm();
      const result = vm.availableCapabilitiesToPropose(
        [readyCap("cloud"), readyCap("data")],
        eligibility(["cloud"]),
      );
      expect(result.map((c) => c.id)).toEqual(["data"]);
    });
  });

  describe("updateDevelopmentSummary", () => {
    it("chama updateAssessmentDevelopmentSummary com os três campos e a versão esperada", async () => {
      const { vm, portfolio } = makeVm();
      await vm.updateDevelopmentSummary(
        "asmt-1",
        { startDoing: "a", stopDoing: "b", continueDoing: "c" },
        2,
      );
      expect(portfolio.updateAssessmentDevelopmentSummary).toHaveBeenCalledWith(
        "asmt-1",
        { startDoing: "a", stopDoing: "b", continueDoing: "c" },
        2,
      );
    });

    it("propaga erro (ex.: 409 de versão desatualizada) — quem chama decide o banner de conflito", async () => {
      const portfolio = fakePortfolioService();
      portfolio.updateAssessmentDevelopmentSummary.mockRejectedValueOnce(new Error("409"));
      const { vm } = makeVm(fakeItemService(), portfolio);
      await expect(
        vm.updateDevelopmentSummary(
          "asmt-1",
          { startDoing: "a", stopDoing: "b", continueDoing: "c" },
          1,
        ),
      ).rejects.toThrow("409");
    });
  });
});
