import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Notice } from "@/lib/gateways/notices.gateway";
import { NoticesViewModel } from "@/lib/view-models";

/**
 * Ressalva da Fase A (onda17/telas-fase-b) — o agrupamento por dia do sino
 * cortava o ISO em UTC (`slice(0, 10)`): um aviso das 22h de São Paulo
 * (01:00Z do dia seguinte) aparecia agrupado no dia ERRADO para o usuário.
 * Dia de aviso é dia LOCAL de quem lê, não o dia do meridiano de Greenwich.
 *
 * O fuso America/Sao_Paulo (UTC-3) é simulado via process.env.TZ — Node
 * reavalia o fuso a cada operação de data desde a v13, e o beforeAll/afterAll
 * devolve o ambiente como estava para não vazar aos demais arquivos do worker.
 */
const originalTz = process.env["TZ"];

beforeAll(() => {
  process.env["TZ"] = "America/Sao_Paulo";
});

afterAll(() => {
  if (originalTz === undefined) delete process.env["TZ"];
  else process.env["TZ"] = originalTz;
});

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

describe("NoticesViewModel — dia LOCAL, não UTC (America/Sao_Paulo)", () => {
  const vm = new NoticesViewModel();

  it("aviso das 22h locais (01:00Z do dia seguinte) pertence ao dia local anterior", () => {
    const groups = vm.groupByDay([notice({ occurredAt: "2026-08-28T01:00:00.000Z" })]);
    expect(groups.map((group) => group.day)).toEqual(["2026-08-27"]);
  });

  it("avisos da mesma noite local ficam no MESMO grupo, mesmo cruzando a meia-noite UTC", () => {
    const groups = vm.groupByDay([
      notice({ id: "notice-a", occurredAt: "2026-08-27T23:30:00.000Z" }),
      notice({ id: "notice-b", occurredAt: "2026-08-28T01:45:00.000Z" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.day).toBe("2026-08-27");
    expect(groups[0]?.notices.map((item) => item.id)).toEqual(["notice-b", "notice-a"]);
  });

  it("aviso do meio do dia local continua no próprio dia", () => {
    const groups = vm.groupByDay([notice({ occurredAt: "2026-08-28T15:00:00.000Z" })]);
    expect(groups.map((group) => group.day)).toEqual(["2026-08-28"]);
  });
});
