import { describe, expect, it } from "vitest";

import type { Notice } from "@/lib/gateways/notices.gateway";
import { NoticeRoutingPolicy } from "@/lib/notice-routing-policy";
import { NoticesViewModel } from "@/lib/view-models";

/**
 * Tela 2 (spec-telas-novas-2026-08-29, FASE A) — a central de avisos nasce
 * com porta + mock tipado. A policy só DECORA (ícone/tom por eventType) — o
 * `link` vem do backend e o escopo (time vs próprio) é do SERVIDOR, nunca da
 * UI.
 *
 * O agrupamento por dia saiu da VM em 2026-09-08 (decisão do dono: a data
 * entra na linha, o cabeçalho de dia acaba). O que entrou no lugar é a
 * paginação do sino: cursor da próxima página e junção do que já chegou.
 */
function notice(overrides: Partial<Notice>): Notice {
  return {
    id: "notice-1",
    eventType: "development-item.deadline-approaching",
    wording: { subjectName: "Ana Martins", tally: 3 },
    link: "/development-plans?professionalId=ana",
    occurredAt: "2026-08-28T09:00:00.000Z",
    readAt: null,
    professionalId: "ana",
    teamId: "team-integration",
    ...overrides,
  };
}

describe("NoticesViewModel — ordem e leitura", () => {
  const vm = new NoticesViewModel();

  it("ordena do mais recente para o mais antigo", () => {
    const ordered = vm.newestFirst([
      notice({ id: "velho", occurredAt: "2026-08-20T08:00:00.000Z" }),
      notice({ id: "novo", occurredAt: "2026-08-28T08:00:00.000Z" }),
      notice({ id: "meio", occurredAt: "2026-08-25T08:00:00.000Z" }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["novo", "meio", "velho"]);
  });

  it("não-lido é readAt nulo", () => {
    expect(vm.isUnread(notice({ readAt: null }))).toBe(true);
    expect(vm.isUnread(notice({ readAt: "2026-08-28T10:00:00.000Z" }))).toBe(false);
  });
});

describe("NoticesViewModel — a paginação do sino", () => {
  const vm = new NoticesViewModel();

  it("o cursor da próxima página é o instante do aviso mais antigo recebido", () => {
    const cursor = vm.cursorAfter(
      [
        notice({ id: "novo", occurredAt: "2026-08-28T08:00:00.000Z" }),
        notice({ id: "velho", occurredAt: "2026-08-20T08:00:00.000Z" }),
      ],
      2,
    );
    expect(cursor).toBe("2026-08-20T08:00:00.000Z");
  });

  it("página incompleta é o fim da caixa: não há próxima", () => {
    expect(vm.cursorAfter([notice({})], 5)).toBeUndefined();
    expect(vm.cursorAfter([], 5)).toBeUndefined();
  });

  it("junta as páginas numa lista só, ordenada e sem repetir aviso", () => {
    const primeira = [
      notice({ id: "b", occurredAt: "2026-08-28T09:30:00.000Z" }),
      notice({ id: "c", occurredAt: "2026-08-28T07:15:00.000Z" }),
    ];
    const segunda = [
      notice({ id: "c", occurredAt: "2026-08-28T07:15:00.000Z" }),
      notice({ id: "a", occurredAt: "2026-08-27T08:00:00.000Z" }),
    ];
    expect(vm.merge([primeira, segunda]).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("sem página nenhuma, a caixa é vazia — nunca undefined", () => {
    expect(vm.merge([])).toEqual([]);
  });
});

describe("NoticeRoutingPolicy — decoração por eventType", () => {
  const policy = new NoticeRoutingPolicy();

  it("mapeia os eventTypes do contrato", () => {
    expect(policy.toneOf("development-item.deadline-approaching")).toBe("warning");
    expect(policy.toneOf("assessment.stalled")).toBe("warning");
    expect(policy.toneOf("assessment.completed")).toBe("success");
    expect(policy.toneOf("mentoring.recorded")).toBe("info");
    expect(policy.toneOf("team-transfer.requested")).toBe("info");
  });

  it("eventType desconhecido não quebra a tela — cai no tom neutro (contrato é extensível)", () => {
    expect(policy.toneOf("futuro.evento.qualquer")).toBe("info");
    expect(policy.iconOf("futuro.evento.qualquer")).toBe("generic");
  });
});
