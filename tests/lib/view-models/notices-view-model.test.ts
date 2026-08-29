import { describe, expect, it } from "vitest";

import type { Notice } from "@/lib/gateways/notices.gateway";
import { NoticeRoutingPolicy } from "@/lib/notice-routing-policy";
import { NoticesViewModel } from "@/lib/view-models";

/**
 * Tela 2 (spec-telas-novas-2026-08-29, FASE A) — a central de avisos nasce
 * com porta + mock tipado. A VM agrupa por dia e ordena do mais recente para
 * o mais antigo; a policy só DECORA (ícone/tom por eventType) — o `link` vem
 * do backend e o escopo (time vs próprio) é do SERVIDOR, nunca da UI.
 */
function notice(overrides: Partial<Notice>): Notice {
  return {
    id: "notice-1",
    eventType: "pdi.item.dueSoon",
    title: "Item de PDI vence em 3 dias",
    link: "/development-plans?architectId=ana",
    occurredAt: "2026-08-28T09:00:00.000Z",
    readAt: null,
    architectId: "ana",
    teamId: "team-integration",
    ...overrides,
  };
}

describe("NoticesViewModel — agrupamento por dia", () => {
  const vm = new NoticesViewModel();

  it("agrupa por dia (mais recente primeiro) e, dentro do dia, do mais novo para o mais velho", () => {
    const groups = vm.groupByDay([
      notice({ id: "a", occurredAt: "2026-08-27T08:00:00.000Z" }),
      notice({ id: "b", occurredAt: "2026-08-28T09:30:00.000Z" }),
      notice({ id: "c", occurredAt: "2026-08-28T07:15:00.000Z" }),
    ]);
    expect(groups.map((group) => group.day)).toEqual(["2026-08-28", "2026-08-27"]);
    expect(groups[0]?.notices.map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("lista vazia produz zero grupos, nunca um grupo vazio", () => {
    expect(vm.groupByDay([])).toEqual([]);
  });

  it("recorta os últimos N para o dropdown do sino sem perder a ordenação", () => {
    const latest = vm.latest(
      [
        notice({ id: "velho", occurredAt: "2026-08-20T08:00:00.000Z" }),
        notice({ id: "novo", occurredAt: "2026-08-28T08:00:00.000Z" }),
        notice({ id: "meio", occurredAt: "2026-08-25T08:00:00.000Z" }),
      ],
      2,
    );
    expect(latest.map((item) => item.id)).toEqual(["novo", "meio"]);
  });

  it("não-lido é readAt nulo", () => {
    expect(vm.isUnread(notice({ readAt: null }))).toBe(true);
    expect(vm.isUnread(notice({ readAt: "2026-08-28T10:00:00.000Z" }))).toBe(false);
  });
});

describe("NoticeRoutingPolicy — decoração por eventType", () => {
  const policy = new NoticeRoutingPolicy();

  it("mapeia os 5 eventTypes do contrato", () => {
    expect(policy.toneOf("pdi.item.dueSoon")).toBe("warning");
    expect(policy.toneOf("assessment.stalled")).toBe("warning");
    expect(policy.toneOf("evidence.awaitingReview")).toBe("info");
    expect(policy.toneOf("assessment.completed")).toBe("success");
    expect(policy.toneOf("mentoring.recorded")).toBe("info");
  });

  it("eventType desconhecido não quebra a tela — cai no tom neutro (contrato é extensível)", () => {
    expect(policy.toneOf("futuro.evento.qualquer")).toBe("info");
    expect(policy.iconOf("futuro.evento.qualquer")).toBe("generic");
  });
});
