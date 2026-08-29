import { describe, expect, it } from "vitest";

import { InMemoryNoticesGateway } from "@/lib/gateways/notices.gateway";

/**
 * O backend do PRD-02 ainda não existe: a tela nasce contra esta PORTA com
 * mock tipado (spec §2). Ligar o real é trocar a implementação registrada no
 * container — zero mudança em tela/VM. O mock precisa se comportar como o
 * contrato: filtro por status, ordenação desc, unreadCount sempre do todo.
 */
describe("InMemoryNoticesGateway", () => {
  it("nasce com fixtures dos 5 eventTypes do contrato", async () => {
    const gateway = new InMemoryNoticesGateway();
    const page = await gateway.notices({ status: "all" });
    const types = new Set(page.notices.map((item) => item.eventType));
    expect(types).toEqual(
      new Set([
        "pdi.item.dueSoon",
        "assessment.stalled",
        "evidence.awaitingReview",
        "assessment.completed",
        "mentoring.recorded",
      ]),
    );
  });

  it("ordena do mais recente para o mais antigo e respeita o limit", async () => {
    const gateway = new InMemoryNoticesGateway();
    const page = await gateway.notices({ status: "all", limit: 3 });
    expect(page.notices).toHaveLength(3);
    const dates = page.notices.map((item) => item.occurredAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("status=unread devolve só não-lidos, mas unreadCount é sempre do conjunto inteiro", async () => {
    const gateway = new InMemoryNoticesGateway();
    const all = await gateway.notices({ status: "all" });
    const unread = await gateway.notices({ status: "unread" });
    expect(unread.notices.every((item) => item.readAt === null)).toBe(true);
    expect(unread.unreadCount).toBe(all.unreadCount);
    expect(all.notices.length).toBeGreaterThan(unread.notices.length);
  });

  it("marcar um aviso como lido reflete na próxima leitura e derruba o unreadCount", async () => {
    const gateway = new InMemoryNoticesGateway();
    const before = await gateway.notices({ status: "unread" });
    const first = before.notices[0];
    expect(first).toBeDefined();
    await gateway.markNoticeRead(first!.id);
    const after = await gateway.notices({ status: "unread" });
    expect(after.unreadCount).toBe(before.unreadCount - 1);
    expect(after.notices.some((item) => item.id === first!.id)).toBe(false);
  });

  it("marcar todos como lidos zera o unreadCount", async () => {
    const gateway = new InMemoryNoticesGateway();
    await gateway.markAllNoticesRead();
    const page = await gateway.notices({ status: "all" });
    expect(page.unreadCount).toBe(0);
    expect(page.notices.every((item) => item.readAt !== null)).toBe(true);
  });
});
