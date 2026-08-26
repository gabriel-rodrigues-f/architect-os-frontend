import { describe, expect, it, vi } from "vitest";

import type { Evidence } from "../domain";
import {
  ArchitectProfileViewModel,
  type ArchitectProfileService,
  type EvidenceDraft,
} from "../view-models/architect-profile-view-model";

/**
 * OO3-10c (Fase OO-3) — mesmo padrão dos demais testes de ViewModel:
 * `ArchitectProfileService` falso com `vi.fn()` (sem montar `useStore()`/
 * React), cobrindo a montagem de payload e as validações que saíram dos
 * três diálogos de Evidência de `architects.$architectId.index.tsx`.
 */
function fakeService(): ArchitectProfileService & {
  addEvidence: ReturnType<typeof vi.fn>;
  resubmitEvidence: ReturnType<typeof vi.fn>;
  reviewEvidence: ReturnType<typeof vi.fn>;
} {
  return {
    addEvidence: vi.fn(async (e: Evidence) => ({ ...e, id: "srv-1" })),
    resubmitEvidence: vi.fn(async () => undefined),
    reviewEvidence: vi.fn(async () => undefined),
  };
}

const draft = (overrides: Partial<EvidenceDraft> = {}): EvidenceDraft => ({
  title: "  Workshop de eventos  ",
  description: "  Condução do workshop  ",
  type: "Project",
  date: "2026-08-20",
  complexity: "Medium",
  project: "",
  url: "",
  issuer: "",
  pdiItemId: "",
  ...overrides,
});

describe("ArchitectProfileViewModel", () => {
  describe("registerEvidence", () => {
    it("id vazio (servidor gera, IDOR-001), competencyIds vazio, status Pending, textos sem espaços nas pontas", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.registerEvidence("ana", draft());
      expect(service.addEvidence).toHaveBeenCalledWith({
        id: "",
        architectId: "ana",
        title: "Workshop de eventos",
        description: "Condução do workshop",
        type: "Project",
        competencyIds: [],
        date: "2026-08-20",
        complexity: "Medium",
        status: "Pending",
      });
    });

    it("project/url/pdiItemId vazios nem entram no corpo; preenchidos entram sem espaços nas pontas", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.registerEvidence(
        "ana",
        draft({ project: "  Loja X  ", url: "  https://exemplo.dev  ", pdiItemId: "item-1" }),
      );
      const [payload] = service.addEvidence.mock.calls[0] as [Record<string, unknown>];
      expect(payload["project"]).toBe("Loja X");
      expect(payload["url"]).toBe("https://exemplo.dev");
      expect(payload["developmentPlanItemId"]).toBe("item-1");

      service.addEvidence.mockClear();
      await vm.registerEvidence("ana", draft());
      const [second] = service.addEvidence.mock.calls[0] as [Record<string, unknown>];
      expect(second).not.toHaveProperty("project");
      expect(second).not.toHaveProperty("url");
      expect(second).not.toHaveProperty("developmentPlanItemId");
    });

    it("issuer só entra para Certification — em outro tipo a chave nem vai, mesmo preenchida", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.registerEvidence("ana", draft({ issuer: "  CNCF  " }));
      const [projectPayload] = service.addEvidence.mock.calls[0] as [Record<string, unknown>];
      expect(projectPayload).not.toHaveProperty("issuer");

      service.addEvidence.mockClear();
      await vm.registerEvidence("ana", draft({ type: "Certification", issuer: "  CNCF  " }));
      const [certPayload] = service.addEvidence.mock.calls[0] as [Record<string, unknown>];
      expect(certPayload["issuer"]).toBe("CNCF");
    });

    it("propaga o erro do serviço — o diálogo decide toast/mensagem", async () => {
      const service = fakeService();
      service.addEvidence.mockRejectedValueOnce(new Error("403 fora do escopo"));
      const vm = new ArchitectProfileViewModel(service);
      await expect(vm.registerEvidence("ana", draft())).rejects.toThrow("403 fora do escopo");
    });
  });

  describe("resubmit", () => {
    const evidence = {
      id: "ev-1",
      description: "Descrição original",
      url: "https://antigo.dev",
    } as Pick<Evidence, "id" | "description" | "url">;

    it("só os campos que mudaram entram no patch (ENT-EVD-002)", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.resubmit(evidence, {
        description: "  Descrição corrigida  ",
        url: "https://antigo.dev",
      });
      expect(service.resubmitEvidence).toHaveBeenCalledWith("ev-1", {
        description: "Descrição corrigida",
      });
    });

    it("nada mudou (só espaços) — patch vazio, sem chave nenhuma", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.resubmit(evidence, {
        description: "  Descrição original  ",
        url: "  https://antigo.dev  ",
      });
      expect(service.resubmitEvidence).toHaveBeenCalledWith("ev-1", {});
    });

    it("evidência sem url: comparar contra '' — preencher a url entra no patch", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.resubmit(
        { ...evidence, url: undefined },
        { description: "Descrição original", url: "https://novo.dev" },
      );
      expect(service.resubmitEvidence).toHaveBeenCalledWith("ev-1", { url: "https://novo.dev" });
    });
  });

  describe("review", () => {
    it("comentário preenchido vai sem espaços nas pontas", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.review("ev-1", "Accepted", "  Ótima evidência  ");
      expect(service.reviewEvidence).toHaveBeenCalledWith("ev-1", {
        status: "Accepted",
        leaderComment: "Ótima evidência",
      });
    });

    it("comentário vazio nem entra no corpo", async () => {
      const service = fakeService();
      const vm = new ArchitectProfileViewModel(service);
      await vm.review("ev-1", "Rejected", "   ");
      expect(service.reviewEvidence).toHaveBeenCalledWith("ev-1", { status: "Rejected" });
    });

    it("propaga o erro do serviço — decisão de Tech Lead nunca aparece salva sem confirmação (EPIC L)", async () => {
      const service = fakeService();
      service.reviewEvidence.mockRejectedValueOnce(new Error("409 revisado por outra pessoa"));
      const vm = new ArchitectProfileViewModel(service);
      await expect(vm.review("ev-1", "Accepted", "")).rejects.toThrow(
        "409 revisado por outra pessoa",
      );
    });
  });
});
