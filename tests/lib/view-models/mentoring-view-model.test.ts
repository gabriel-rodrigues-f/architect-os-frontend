import { describe, expect, it, vi } from "vitest";

import type { DevelopmentPlan, MentoringSession, ProficiencyUpdate } from "@/lib/domain";
import type { Gap } from "@/lib/selectors";
import {
  MentoringViewModel,
  type MentoringService,
  type MentoringSessionDraft,
} from "@/lib/view-models";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — sétimo (e último) ViewModel de tela desta fase, testado
 * direto com um `MentoringService` falso (sem montar `useStore()`/React),
 * mesmo espírito de `learning-paths-view-model.test.ts`/
 * `development-plans-view-model.test.ts`: a cobertura de componente já
 * existente (`mentoring-validation.test.tsx`/`mentoring-followup.test.tsx`/
 * `mentoring-to-pdi.test.tsx`/`mentoring-proficiency.test.tsx`) já cobre o
 * fim a fim via UI (formulário, autorização, PDI); este cobre a classe
 * isolada.
 */
function fakeService(): MentoringService & {
  addMentoringSession: ReturnType<typeof vi.fn>;
  scheduleMentoringFollowUp: ReturnType<typeof vi.fn>;
  createPlanItemFromGap: ReturnType<typeof vi.fn>;
} {
  return {
    addMentoringSession: vi.fn(
      async (m: MentoringSession) => ({ ...m, id: "sessao-nova" }) as MentoringSession,
    ),
    scheduleMentoringFollowUp: vi.fn(
      async (id: string, nextSession: string | null) =>
        ({ id, nextSession }) as unknown as MentoringSession,
    ),
    createPlanItemFromGap: vi.fn(
      async (architectId: string) => ({ id: "plano-1", architectId }) as unknown as DevelopmentPlan,
    ),
  };
}

function makeVm(service = fakeService()) {
  return { vm: new MentoringViewModel(service), service };
}

function draft(overrides: Partial<MentoringSessionDraft> = {}): MentoringSessionDraft {
  return {
    menteeId: "ana",
    date: "2026-08-20",
    topic: "Revisão de arquitetura de eventos",
    notes: "Discutimos o desenho de filas",
    decisions: "Adotar outbox pattern",
    actions: "Prototipar outbox até sexta",
    nextSession: "",
    ...overrides,
  };
}

const gap = (competencyId: string): Gap =>
  ({
    competency: { id: competencyId, name: competencyId } as Gap["competency"],
    item: { competencyId } as Gap["item"],
    gap: 1,
    assessmentId: "assessment-1",
    targetSemantics: "NEXT_ROLE",
  }) as Gap;

describe("MentoringViewModel", () => {
  describe("createSession", () => {
    it("monta o payload com id vazio, mentor da sessão autenticada, nextSession só quando preenchido", async () => {
      const { vm, service } = makeVm();
      const proficiencyUpdates: ProficiencyUpdate[] = [
        { competencyId: "cloud-k8s", observedLevel: 3 },
      ];
      await vm.createSession("Beatriz Lead", draft(), 45, ["cloud-k8s"], proficiencyUpdates);
      expect(service.addMentoringSession).toHaveBeenCalledWith(
        {
          id: "",
          mentor: "Beatriz Lead",
          menteeId: "ana",
          date: "2026-08-20",
          durationMin: 45,
          topic: "Revisão de arquitetura de eventos",
          competencyIds: ["cloud-k8s"],
          notes: "Discutimos o desenho de filas",
          decisions: "Adotar outbox pattern",
          actions: "Prototipar outbox até sexta",
        },
        proficiencyUpdates,
      );
    });

    it("inclui nextSession no payload só quando preenchido", async () => {
      const { vm, service } = makeVm();
      await vm.createSession("Beatriz Lead", draft({ nextSession: "2026-09-01" }), 30, [], []);
      expect(service.addMentoringSession).toHaveBeenCalledWith(
        expect.objectContaining({ nextSession: "2026-09-01" }),
        [],
      );
    });

    it("propaga o erro do serviço — quem chama decide toast/mensagem", async () => {
      const service = fakeService();
      service.addMentoringSession.mockRejectedValueOnce(new Error("403"));
      const { vm } = makeVm(service);
      await expect(vm.createSession("Beatriz Lead", draft(), 30, [], [])).rejects.toThrow("403");
    });
  });

  describe("scheduleFollowUp", () => {
    it("delega (sessionId, nextSession) 1:1 para o serviço", async () => {
      const { vm, service } = makeVm();
      await vm.scheduleFollowUp("sessao-1", "2026-09-10");
      expect(service.scheduleMentoringFollowUp).toHaveBeenCalledWith("sessao-1", "2026-09-10");
    });

    it("aceita null para limpar o follow-up", async () => {
      const { vm, service } = makeVm();
      await vm.scheduleFollowUp("sessao-1", null);
      expect(service.scheduleMentoringFollowUp).toHaveBeenCalledWith("sessao-1", null);
    });
  });

  describe("eligibleGapForPlan", () => {
    it("ORIENTACAO-NONA-RODADA, Seção 12/17.1: primeira competência da sessão com gap de progressão ainda não incluída no plano", () => {
      const { vm } = makeVm();
      const session = { competencyIds: ["cloud-terraform", "cloud-k8s"] };
      const gaps = [gap("cloud-k8s")];
      const eligible = vm.eligibleGapForPlan(session, gaps, undefined);
      expect(eligible?.item.competencyId).toBe("cloud-k8s");
    });

    it("exclui competência já presente no plano", () => {
      const { vm } = makeVm();
      const session = { competencyIds: ["cloud-k8s"] };
      const gaps = [gap("cloud-k8s")];
      const plan = { items: [{ competencyId: "cloud-k8s" }] } as unknown as DevelopmentPlan;
      expect(vm.eligibleGapForPlan(session, gaps, plan)).toBeUndefined();
    });

    it("sem nenhuma competência da sessão com gap de progressão, devolve undefined", () => {
      const { vm } = makeVm();
      const session = { competencyIds: ["cloud-observability"] };
      const gaps = [gap("cloud-k8s")];
      expect(vm.eligibleGapForPlan(session, gaps, undefined)).toBeUndefined();
    });
  });

  describe("sendToPlan", () => {
    it("gera id no cliente (pdi-*), actionType 'Mentor', objective/actionPlan da sessão, owner do mentorado", async () => {
      const { vm, service } = makeVm();
      const session = {
        menteeId: "ana",
        topic: "Revisão de arquitetura de eventos",
        actions: "Prototipar outbox até sexta",
        nextSession: "2026-09-01",
      };
      await vm.sendToPlan(
        session,
        { name: "Ana Martins" },
        {
          assessmentId: "assessment-1",
          competencyId: "cloud-k8s",
        },
      );
      expect(service.createPlanItemFromGap).toHaveBeenCalledWith(
        "ana",
        expect.objectContaining({
          assessmentId: "assessment-1",
          competencyId: "cloud-k8s",
          objective: "Revisão de arquitetura de eventos",
          actionType: "Mentor",
          actionPlan: "Prototipar outbox até sexta",
          targetDate: "2026-09-01",
          owner: "Ana Martins",
        }),
      );
      const [, item] = service.createPlanItemFromGap.mock.calls[0] as [string, { id: string }];
      expect(item.id).toMatch(/^pdi-ana-cloud-k8s-\d+$/);
    });

    /**
     * ENG-04 — antes o prazo caía para `hoje` quando a sessão não tinha
     * próximo encontro: um item nascia vencido, com um prazo que ninguém
     * escolheu e indistinguível de um prazo real. Prazo ausente é erro.
     */
    it("sem nextSession na sessão, recusa criar o item em vez de inventar o prazo de hoje", async () => {
      const { vm, service } = makeVm();
      const session = {
        menteeId: "ana",
        topic: "Tópico",
        actions: "Ação",
        nextSession: undefined,
      };
      await expect(
        vm.sendToPlan(
          session,
          { name: "Ana Martins" },
          {
            assessmentId: "assessment-1",
            competencyId: "cloud-k8s",
          },
        ),
      ).rejects.toBeInstanceOf(Error);
      expect(service.createPlanItemFromGap).not.toHaveBeenCalled();
    });

    it("propaga o erro do serviço — quem chama decide toast/mensagem", async () => {
      const service = fakeService();
      service.createPlanItemFromGap.mockRejectedValueOnce(new Error("409 gap inválido"));
      const { vm } = makeVm(service);
      const session = { menteeId: "ana", topic: "X", actions: "Y", nextSession: "2026-09-01" };
      await expect(
        vm.sendToPlan(
          session,
          { name: "Ana Martins" },
          {
            assessmentId: "assessment-1",
            competencyId: "cloud-k8s",
          },
        ),
      ).rejects.toThrow("409 gap inválido");
    });
  });
});
