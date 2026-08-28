import { describe, expect, it, vi } from "vitest";

import type { MentoringService } from "@/lib/view-models/mentoring-view-model";
import { MentoringViewModel } from "@/lib/view-models";

/**
 * ENG-04 — mandar a ação da mentoria para o PDI usava
 * `session.nextSession ?? hoje`: sem próximo encontro agendado, o item nascia
 * com prazo de HOJE, gravado no servidor e indistinguível de um prazo que
 * alguém escolheu. Prazo ausente é erro, não "hoje".
 */

const service = () => ({
  addMentoringSession: vi.fn(),
  scheduleMentoringFollowUp: vi.fn(),
  createPlanItemFromGap: vi.fn().mockResolvedValue({ id: "pdi-1" }),
});

const session = (nextSession?: string) => ({
  menteeId: "ana",
  topic: "Revisão de IAM",
  actions: "Documentar o ADR",
  ...(nextSession ? { nextSession } : {}),
});

describe("MentoringViewModel.sendToPlan", () => {
  it("recusa criar o item quando a mentoria não tem próximo encontro agendado", async () => {
    const calls = service();
    const viewModel = new MentoringViewModel(calls as unknown as MentoringService);

    await expect(
      viewModel.sendToPlan(
        session(),
        { name: "Ana Martins" },
        {
          assessmentId: "ana-h2",
          competencyId: "security-iam",
        },
      ),
    ).rejects.toBeInstanceOf(Error);
    expect(calls.createPlanItemFromGap).not.toHaveBeenCalled();
  });

  it("usa a data do próximo encontro como prazo quando ela existe", async () => {
    const calls = service();
    const viewModel = new MentoringViewModel(calls as unknown as MentoringService);

    await viewModel.sendToPlan(
      session("2026-11-30"),
      { name: "Ana Martins" },
      {
        assessmentId: "ana-h2",
        competencyId: "security-iam",
      },
    );

    expect(calls.createPlanItemFromGap).toHaveBeenCalledWith(
      "ana",
      expect.objectContaining({ targetDate: "2026-11-30" }),
    );
  });
});
